import type { Metadata } from "next";
import { BookDown, BookUp, Check, ClipboardCheck, Inbox, X } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Avatar, Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { requireStaffWith } from "@/lib/auth";
import { fmtDate, fmtDateTime, fullName, initials } from "@/lib/format";
import { booksById, classOfStudents, copiesById, LOAN_COLUMNS, peopleById, type LoanRow } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";
import { decideRequest, verifyReturn } from "../actions";

export const metadata: Metadata = { title: "So'rovlar" };

type RequestRow = { id: string; requester_id: string; kind: "borrow" | "return"; copy_id: string; created_at: string };

export default async function RequestsPage() {
  const user = await requireStaffWith((u) => u.isCirculator);
  const db = await getServerClient();

  const [{ data: reqData }, { data: pendingData }] = await Promise.all([
    db
      .from("loan_requests")
      .select("id, requester_id, kind, copy_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(200),
    user.isLibrarian
      ? db.from("loans").select(LOAN_COLUMNS).eq("status", "return_pending").order("return_recorded_at").limit(200)
      : Promise.resolve({ data: [] as LoanRow[] }),
  ]);
  const requests = (reqData ?? []) as RequestRow[];
  const pending = (pendingData ?? []) as LoanRow[];

  const copies = await copiesById(db, requests.map((r) => r.copy_id));
  const [books, people, classes] = await Promise.all([
    booksById(db, [...[...copies.values()].map((c) => c.book_id), ...pending.map((l) => l.book_id)]),
    peopleById(db, [...requests.map((r) => r.requester_id), ...pending.map((l) => l.borrower_id)]),
    classOfStudents(db, [...requests.map((r) => r.requester_id), ...pending.map((l) => l.borrower_id)]),
  ]);

  return (
    <>
      <PageHeader title="So'rovlar" description="O'quvchilar telefonidan yuborgan so'rovlar va tasdiq kutayotgan qaytarishlar." />

      <div className="space-y-6">
        <Card>
          <CardHeader
            icon={Inbox}
            title="O'quvchi so'rovlari"
            description="O'quvchi kitob yorlig'ini o'zi skaner qilgan. Kitob qo'lingizda ekanini tekshirib tasdiqlang."
            action={<Badge tone={requests.length ? "gold" : "neutral"}>{requests.length}</Badge>}
          />
          {requests.length === 0 ? (
            <EmptyState icon={Inbox} title="Yangi so'rov yo'q" description="O'quvchi so'rov yuborganda shu yerda chiqadi." />
          ) : (
            <ul className="divide-y divide-line/60">
              {requests.map((r) => {
                const person = people.get(r.requester_id);
                const copy = copies.get(r.copy_id);
                const book = copy ? books.get(copy.book_id) : undefined;
                return (
                  <li key={r.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {person && <Avatar text={initials(person)} />}
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">
                          {fullName(person)}{" "}
                          <span className="font-normal text-muted">· {classes.get(r.requester_id)?.name ?? "—"}</span>
                        </p>
                        <p className="truncate text-sm text-muted">
                          {book?.title ?? "—"} · nusxa №{copy?.copy_no ?? "?"} · {fmtDateTime(r.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.kind === "borrow" ? (
                        <Badge tone="brand">
                          <BookUp className="size-3" /> Olmoqchi
                        </Badge>
                      ) : (
                        <Badge tone="gold">
                          <BookDown className="size-3" /> Qaytarmoqchi
                        </Badge>
                      )}
                      <ActionForm action={decideRequest} className="flex flex-wrap items-center gap-2" inlineStatus>
                        <input type="hidden" name="request_id" value={r.id} />
                        <SubmitButton name="approve" value="1" variant="success" size="sm">
                          <Check className="size-4" /> Tasdiqlash
                        </SubmitButton>
                        <SubmitButton name="approve" value="0" variant="secondary" size="sm">
                          <X className="size-4" /> Rad
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {user.isLibrarian && (
          <Card>
            <CardHeader
              icon={ClipboardCheck}
              title="Tasdiq kutayotgan qaytarishlar"
              description="Sinf rahbari qabul qilgan kitoblar. Kitob kutubxonaga yetib kelganini tasdiqlang."
              action={<Badge tone={pending.length ? "warn" : "neutral"}>{pending.length}</Badge>}
            />
            {pending.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Hammasi tasdiqlangan" />
            ) : (
              <ul className="divide-y divide-line/60">
                {pending.map((l) => {
                  const person = people.get(l.borrower_id);
                  return (
                    <li key={l.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {person && <Avatar text={initials(person)} />}
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{fullName(person)}</p>
                          <p className="truncate text-sm text-muted">
                            {books.get(l.book_id)?.title ?? "—"} · olingan {fmtDate(l.borrowed_at)} · qaytarilgan{" "}
                            {fmtDateTime(l.return_recorded_at)}
                          </p>
                        </div>
                      </div>
                      <ActionForm action={verifyReturn} className="flex flex-wrap items-center gap-2" inlineStatus>
                        <input type="hidden" name="loan_id" value={l.id} />
                        <SubmitButton name="accept" value="1" variant="success" size="sm">
                          <Check className="size-4" /> Kitob keldi
                        </SubmitButton>
                        <SubmitButton name="accept" value="0" variant="secondary" size="sm">
                          <X className="size-4" /> Kelmadi
                        </SubmitButton>
                      </ActionForm>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
