import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, GraduationCap, IdCard, School, Search, UserPlus, Users } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Avatar, Badge, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, cn, inputClass } from "@/components/ui";
import { requireStaffArea } from "@/lib/auth";
import { fullName, initials } from "@/lib/format";
import { classOfStudents, currentClasses, currentYear } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";
import { createClass } from "./actions";
import { CreatePersonForm } from "./CodeForms";

export const metadata: Metadata = { title: "O'quvchilar" };

type Person = { id: string; first_name: string; last_name: string; login_id: string; kind: string; is_active: boolean };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; q?: string; tab?: string }>;
}) {
  const user = await requireStaffArea();
  const sp = await searchParams;
  const tab = sp.tab === "staff" ? "staff" : "students";
  const db = await getServerClient();

  const [classes, year, { data: peopleData }, { data: openLoans }] = await Promise.all([
    currentClasses(db),
    currentYear(db),
    db
      .from("profiles")
      .select("id, first_name, last_name, login_id, kind, is_active")
      .in("kind", tab === "students" ? ["student"] : ["teacher", "staff"])
      .order("last_name")
      .order("first_name")
      .limit(2000),
    db.from("loans").select("borrower_id").in("status", ["active", "return_pending"]),
  ]);
  let people = (peopleData ?? []) as Person[];
  const classOf = await classOfStudents(db, people.map((p) => p.id));
  const loanCount = new Map<string, number>();
  for (const l of openLoans ?? []) loanCount.set(l.borrower_id, (loanCount.get(l.borrower_id) ?? 0) + 1);

  const selectedClass = classes.find((c) => c.id === sp.class);
  if (tab === "students" && selectedClass) people = people.filter((p) => classOf.get(p.id)?.id === selectedClass.id);
  const q = (sp.q ?? "").trim().toLowerCase();
  if (q) people = people.filter((p) => `${p.last_name} ${p.first_name} ${p.login_id}`.toLowerCase().includes(q));

  const counts = new Map<string, number>();
  for (const c of classOf.values()) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);

  const { data: teacherData } = user.isStaff
    ? await db.from("profiles").select("id, first_name, last_name").in("kind", ["teacher", "staff"]).eq("is_active", true).order("last_name")
    : { data: [] };
  const teachers = (teacherData ?? []) as { id: string; first_name: string; last_name: string }[];

  const href = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab, class: sp.class, q: sp.q, ...params })) if (v) s.set(k, v);
    return `/kutubxonachi/oquvchilar?${s}`;
  };

  return (
    <>
      <PageHeader
        title={tab === "students" ? "O'quvchilar" : "O'qituvchi va xodimlar"}
        description={year ? `${year.label} o'quv yili · ${classes.length} ta sinf` : "O'quv yili hali belgilanmagan"}
        action={
          user.isStaff &&
          tab === "students" && (
            <Link
              href={`/kutubxonachi/oquvchilar/kartalar${selectedClass ? `?class=${selectedClass.id}` : ""}`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 font-semibold text-ink hover:bg-paper-2/60"
            >
              <IdCard className="size-4" /> Kartalarni chop etish
            </Link>
          )
        }
      />

      <div className="mb-4 flex gap-1 rounded-xl bg-paper-2/70 p-1 sm:w-fit">
        {[
          { key: "students", label: "O'quvchilar" },
          { key: "staff", label: "O'qituvchilar" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/kutubxonachi/oquvchilar?tab=${t.key}`}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold",
              tab === t.key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <div className="space-y-3 border-b border-line/70 p-4">
            <form className="relative">
              <input type="hidden" name="tab" value={tab} />
              {sp.class && <input type="hidden" name="class" value={sp.class} />}
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input name="q" defaultValue={sp.q} placeholder="Ism, familiya yoki ID" className={`${inputClass} pl-10`} />
            </form>
            {tab === "students" && classes.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <Link
                  href={href({ class: undefined })}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold",
                    !selectedClass ? "bg-brand-700 text-white" : "bg-paper text-muted hover:text-ink",
                  )}
                >
                  Barchasi
                </Link>
                {classes.map((c) => (
                  <Link
                    key={c.id}
                    href={href({ class: c.id })}
                    className={cn(
                      "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold",
                      selectedClass?.id === c.id ? "bg-brand-700 text-white" : "bg-paper text-muted hover:text-ink",
                    )}
                  >
                    {c.name} <span className="opacity-60">{counts.get(c.id) ?? 0}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {people.length === 0 ? (
            <EmptyState icon={Users} title="Hech kim topilmadi" description={user.isStaff ? "O'ng tomondagi forma orqali qo'shing." : undefined} />
          ) : (
            <ul className="divide-y divide-line/60">
              {people.map((p) => (
                <li key={p.id}>
                  <Link href={`/kutubxonachi/oquvchilar/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper/60">
                    <Avatar text={initials(p)} className={p.is_active ? "" : "bg-paper-2 text-muted"} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate font-semibold", p.is_active ? "text-ink" : "text-muted line-through")}>{fullName(p)}</p>
                      <p className="truncate text-xs text-muted">
                        ID {p.login_id}
                        {classOf.get(p.id) ? ` · ${classOf.get(p.id)!.name}` : ""}
                      </p>
                    </div>
                    {(loanCount.get(p.id) ?? 0) > 0 && <Badge tone="brand">{loanCount.get(p.id)} kitob</Badge>}
                    {!p.is_active && <Badge tone="neutral">Nofaol</Badge>}
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {user.isStaff && (
          <div className="space-y-6">
            <Card>
              <CardHeader icon={UserPlus} title="Yangi foydalanuvchi" description="Faollashtirish kodi darhol beriladi." />
              <CreatePersonForm classes={classes} schoolCode={user.schoolCode} defaultClass={selectedClass?.id} />
            </Card>

            <Card>
              <CardHeader icon={School} title="Sinflar" description={year ? `${year.label} o'quv yili` : "Birinchi sinf bilan o'quv yili yaratiladi"} />
              {classes.length > 0 && (
                <ul className="divide-y divide-line/60 border-b border-line/70">
                  {classes.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <GraduationCap className="size-4 text-muted" />
                      <span className="flex-1 font-semibold text-ink">{c.name}</span>
                      <span className="text-muted">{counts.get(c.id) ?? 0} o&apos;quvchi</span>
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm action={createClass} className="space-y-3 p-5" resetOnSuccess>
                <div className="grid grid-cols-[1fr_88px] gap-3">
                  <Field label="Sinf nomi">
                    <Input name="name" placeholder="7-A" required />
                  </Field>
                  <Field label="Daraja">
                    <Input name="grade" type="number" min={1} max={12} />
                  </Field>
                </div>
                <Field label="Sinf rahbari">
                  <Select name="homeroom" defaultValue="">
                    <option value="">—</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {fullName(t)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <SubmitButton variant="secondary" className="w-full">
                  Sinf qo&apos;shish
                </SubmitButton>
              </ActionForm>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
