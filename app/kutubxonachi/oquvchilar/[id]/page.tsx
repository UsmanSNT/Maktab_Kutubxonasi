import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpen, Coins, IdCard, KeyRound, RefreshCw, Shield, SquarePen, UserRound } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { QrCode } from "@/components/QrCode";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, StatCard, Table, Td, Th } from "@/components/ui";
import { requireStaffArea, type Role } from "@/lib/auth";
import { profileQrText } from "@/lib/codes";
import { fmtDate, fullName, num, pct } from "@/lib/format";
import { booksById, classOfStudents, currentClasses, LOAN_COLUMNS, NOT_SCORED_REASON, type LoanRow } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";
import { changeClass, rotateCard, saveRoles, setActive, updateName } from "../actions";
import { IssueCodeForm } from "../CodeForms";

export const metadata: Metadata = { title: "Profil" };

const ROLE_LABELS: { role: Role; label: string; hint: string }[] = [
  { role: "librarian", label: "Kutubxonachi", hint: "Berish, qabul, katalog, o'quvchilar" },
  { role: "admin", label: "Administrator", hint: "Sozlamalar, rollar, marralar" },
  { role: "class_teacher", label: "Sinf rahbari", hint: "O'z sinfini ko'radi" },
  { role: "quiz_editor", label: "Test muharriri", hint: "Savollar yozadi va tasdiqlaydi" },
];

type Attempt = { loan_id: string; status: string; score_bp: number | null; max_points: number };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaffArea();
  const db = await getServerClient();

  const { data: person } = await db
    .from("profiles")
    .select("id, first_name, last_name, login_id, kind, is_active, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!person) notFound();

  const [{ data: loanData }, { data: attemptData }, { data: card }, { data: ledger }, { data: memberships }, classes, classOf] =
    await Promise.all([
      db.from("loans").select(LOAN_COLUMNS).eq("borrower_id", id).order("borrowed_at", { ascending: false }).limit(200),
      db.from("quiz_attempts").select("loan_id, status, score_bp, max_points").eq("student_id", id).neq("status", "voided"),
      db.from("profile_codes").select("public_code").eq("profile_id", id).maybeSingle(),
      db.from("coin_ledger").select("amount").eq("profile_id", id),
      user.isAdmin ? db.from("memberships").select("role, can_circulate").eq("profile_id", id) : Promise.resolve({ data: null }),
      currentClasses(db),
      classOfStudents(db, [id]),
    ]);
  const loans = (loanData ?? []) as LoanRow[];
  const attempts = new Map(((attemptData ?? []) as Attempt[]).map((a) => [a.loan_id, a]));
  const books = await booksById(db, loans.map((l) => l.book_id));
  const balance = (ledger ?? []).reduce((s, r) => s + (r.amount as number), 0);
  const myClass = classOf.get(id);
  const roles = new Set((memberships ?? []).map((m) => m.role as Role));
  const canCirculate = (memberships ?? []).some((m) => m.role === "class_teacher" && m.can_circulate);

  const scored = loans.filter((l) => l.scored);
  const points = scored.reduce((s, l) => {
    const a = attempts.get(l.id);
    const quiz = a?.status === "completed" && a.score_bp != null ? Math.floor((a.max_points * a.score_bp + 5000) / 10000) : 0;
    return s + (l.base_points ?? 0) + quiz;
  }, 0);
  const tests = [...attempts.values()].filter((a) => a.status === "completed" && a.score_bp != null);
  const avg = tests.length ? Math.round(tests.reduce((s, a) => s + a.score_bp!, 0) / tests.length) : null;

  return (
    <>
      <PageHeader
        back={{ href: "/kutubxonachi/oquvchilar", label: "O'quvchilar" }}
        title={fullName(person)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            ID <b className="font-mono text-ink">{person.login_id}</b>
            {myClass && <Badge tone="brand">{myClass.name}</Badge>}
            {!person.is_active && <Badge tone="bad">Nofaol</Badge>}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="O'qilgan kitoblar" value={num(scored.length)} icon={BookOpen} />
        <StatCard label="Ball" value={num(points)} icon={Shield} tone="gold" />
        <StatCard label="Test o'rtachasi" value={pct(avg)} hint={`${tests.length} ta test`} icon={KeyRound} tone="ok" />
        <StatCard label={user.currency} value={num(balance)} icon={Coins} tone="gold" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader icon={BookOpen} title="Kitoblar tarixi" />
          {loans.length === 0 ? (
            <EmptyState icon={BookOpen} title="Hali kitob olmagan" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Kitob</Th>
                  <Th>Olingan</Th>
                  <Th>Holat</Th>
                  <Th className="text-right">Test</Th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => {
                  const a = attempts.get(l.id);
                  return (
                    <tr key={l.id}>
                      <Td className="font-semibold text-ink">{books.get(l.book_id)?.title ?? "—"}</Td>
                      <Td className="whitespace-nowrap text-muted">{fmtDate(l.borrowed_at)}</Td>
                      <Td>
                        {l.status === "active" ? (
                          <Badge tone="brand">{fmtDate(l.due_at)} gacha</Badge>
                        ) : l.status === "return_pending" ? (
                          <Badge tone="warn">Tasdiq kutilmoqda</Badge>
                        ) : l.scored ? (
                          <Badge tone="ok">Hisoblandi</Badge>
                        ) : (
                          <Badge tone="neutral">{NOT_SCORED_REASON[l.not_scored_reason ?? ""] ?? "Qaytarildi"}</Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        {!a ? (
                          <span className="text-muted">—</span>
                        ) : a.status === "completed" ? (
                          <Badge tone="ok">{pct(a.score_bp)}</Badge>
                        ) : a.status === "pending" || a.status === "in_progress" ? (
                          <Badge tone="brand">Ochiq</Badge>
                        ) : (
                          <Badge tone="neutral">{a.status === "expired" ? "Muddati o'tdi" : "Bekor"}</Badge>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          {card && (
            <Card>
              <CardHeader icon={IdCard} title="Kutubxona kartasi" />
              <div className="flex flex-col items-center gap-4 p-5">
                <div className="rounded-2xl border border-line p-4">
                  <QrCode text={profileQrText(card.public_code)} size={168} />
                </div>
                {user.isStaff && (
                  <ActionForm action={rotateCard} className="w-full space-y-2 text-center">
                    <input type="hidden" name="profile_id" value={id} />
                    <SubmitButton variant="ghost" size="sm">
                      <RefreshCw className="size-3.5" /> Karta yo&apos;qoldi — kodni almashtirish
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            </Card>
          )}

          {user.isStaff && (
            <Card>
              <CardHeader icon={KeyRound} title="Kirish" description="Parol o'rnatish yoki tiklash uchun bir martalik kod." />
              <div className="p-5">
                <IssueCodeForm profileId={id} login={person.login_id} schoolCode={user.schoolCode} />
              </div>
            </Card>
          )}

          {user.isStaff && (
            <Card>
              <CardHeader icon={SquarePen} title="Ma'lumotlar" />
              <div className="space-y-5 p-5">
                <ActionForm action={updateName} className="space-y-3">
                  <input type="hidden" name="profile_id" value={id} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Familiya">
                      <Input name="last_name" defaultValue={person.last_name} required />
                    </Field>
                    <Field label="Ism">
                      <Input name="first_name" defaultValue={person.first_name} required />
                    </Field>
                  </div>
                  <SubmitButton variant="secondary" size="sm">
                    Saqlash
                  </SubmitButton>
                </ActionForm>

                {person.kind === "student" && (
                  <ActionForm action={changeClass} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="profile_id" value={id} />
                    <div className="flex-1">
                      <Field label="Sinf">
                        <Select name="class_id" defaultValue={myClass?.id ?? ""}>
                          <option value="">—</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <SubmitButton variant="secondary">Saqlash</SubmitButton>
                  </ActionForm>
                )}

                <ActionForm action={setActive} className="border-t border-line/70 pt-4">
                  <input type="hidden" name="profile_id" value={id} />
                  <input type="hidden" name="active" value={person.is_active ? "0" : "1"} />
                  <SubmitButton variant={person.is_active ? "ghost" : "success"} size="sm" className={person.is_active ? "text-bad-600 hover:bg-bad-50" : ""}>
                    {person.is_active ? "Hisobni o'chirish (nofaol)" : "Hisobni faollashtirish"}
                  </SubmitButton>
                </ActionForm>
              </div>
            </Card>
          )}

          {user.isAdmin && person.kind !== "student" && (
            <Card>
              <CardHeader icon={UserRound} title="Rollar" description="Faqat administrator o'zgartiradi." />
              <ActionForm action={saveRoles} className="space-y-3 p-5">
                <input type="hidden" name="profile_id" value={id} />
                {ROLE_LABELS.map((r) => (
                  <label key={r.role} className="flex items-start gap-3 rounded-xl p-2 hover:bg-paper">
                    <input type="checkbox" name={`role_${r.role}`} defaultChecked={roles.has(r.role)} className="mt-1 size-4 accent-brand-700" />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{r.label}</span>
                      <span className="block text-xs text-muted">{r.hint}</span>
                    </span>
                  </label>
                ))}
                <label className="ml-9 flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="can_circulate" defaultChecked={canCirculate} className="size-4 accent-brand-700" />
                  Sinf rahbari kitob bera/qabul qila oladi
                </label>
                <SubmitButton variant="secondary" className="w-full">
                  Rollarni saqlash
                </SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
