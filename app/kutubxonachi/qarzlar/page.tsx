import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th, cn } from "@/components/ui";
import { requireStaffArea } from "@/lib/auth";
import { daysUntil, fmtDate, fullName, requestNow } from "@/lib/format";
import { booksById, classOfStudents, LOAN_COLUMNS, NOT_SCORED_REASON, peopleById, type LoanRow } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Qarzlar" };

const FILTERS = [
  { key: "active", label: "Faol" },
  { key: "overdue", label: "Muddati o'tgan" },
  { key: "pending", label: "Tasdiq kutilmoqda" },
  { key: "returned", label: "Qaytarilgan" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

export default async function LoansPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireStaffArea();
  const { f } = await searchParams;
  const filter: FilterKey = FILTERS.some((x) => x.key === f) ? (f as FilterKey) : "active";
  const db = await getServerClient();
  const now = requestNow();

  let q = db.from("loans").select(LOAN_COLUMNS).limit(300);
  if (filter === "active") q = q.eq("status", "active").order("due_at");
  if (filter === "overdue") q = q.eq("status", "active").lt("due_at", new Date(now).toISOString()).order("due_at");
  if (filter === "pending") q = q.eq("status", "return_pending").order("return_recorded_at");
  if (filter === "returned") q = q.eq("status", "returned").order("return_verified_at", { ascending: false });
  const { data } = await q;
  const loans = (data ?? []) as LoanRow[];

  const [books, people, classes] = await Promise.all([
    booksById(db, loans.map((l) => l.book_id)),
    peopleById(db, loans.map((l) => l.borrower_id)),
    classOfStudents(db, loans.map((l) => l.borrower_id)),
  ]);

  return (
    <>
      <PageHeader title="Qarzlar" description="Kimda qaysi kitob va qachongacha." />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={`/kutubxonachi/qarzlar?f=${x.key}`}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              filter === x.key ? "bg-brand-700 text-white" : "bg-white text-muted ring-1 ring-line hover:text-ink",
            )}
          >
            {x.label}
          </Link>
        ))}
      </div>

      <Card>
        {loans.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Bu bo'limda yozuv yo'q" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Kitob</Th>
                <Th>Kitobxon</Th>
                <Th>Olingan</Th>
                <Th>{filter === "returned" ? "Qaytarilgan" : "Muddat"}</Th>
                <Th className="text-right">Holat</Th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => {
                const d = daysUntil(l.due_at, now);
                return (
                  <tr key={l.id} className="hover:bg-paper/60">
                    <Td>
                      <p className="font-semibold text-ink">{books.get(l.book_id)?.title ?? "—"}</p>
                      <p className="text-xs text-muted">{books.get(l.book_id)?.author}</p>
                    </Td>
                    <Td>
                      <Link href={`/kutubxonachi/oquvchilar/${l.borrower_id}`} className="font-medium text-ink hover:text-brand-700">
                        {fullName(people.get(l.borrower_id))}
                      </Link>
                      <p className="text-xs text-muted">{classes.get(l.borrower_id)?.name ?? ""}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{fmtDate(l.borrowed_at)}</Td>
                    <Td className="whitespace-nowrap text-muted">
                      {filter === "returned" ? fmtDate(l.return_verified_at) : fmtDate(l.due_at)}
                    </Td>
                    <Td className="text-right">
                      {l.status === "returned" ? (
                        l.scored ? (
                          <Badge tone="ok">+{l.base_points} ball</Badge>
                        ) : (
                          <Badge tone="neutral">{NOT_SCORED_REASON[l.not_scored_reason ?? ""] ?? "Hisoblanmadi"}</Badge>
                        )
                      ) : l.status === "return_pending" ? (
                        <Badge tone="warn">Tasdiq kutilmoqda</Badge>
                      ) : d < 0 ? (
                        <Badge tone="bad">{-d} kun kechikdi</Badge>
                      ) : d <= 2 ? (
                        <Badge tone="warn">{d === 0 ? "Bugun" : `${d} kun qoldi`}</Badge>
                      ) : (
                        <Badge tone="brand">{d} kun qoldi</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
