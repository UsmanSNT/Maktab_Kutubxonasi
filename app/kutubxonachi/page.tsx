import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BookCopy,
  BookDown,
  BookUp,
  CalendarClock,
  Inbox,
  Medal,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Avatar, Badge, Card, CardHeader, EmptyState, LinkButton, StatCard } from "@/components/ui";
import { requireStaffArea } from "@/lib/auth";
import { daysUntil, fmtDate, fmtDateTime, fullName, initials, num, requestNow } from "@/lib/format";
import { booksById, LOAN_COLUMNS, peopleById, type LoanRow } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";
import { NotificationList } from "@/components/NotificationList";

export const metadata: Metadata = { title: "Bosh panel" };

type Leader = { place: number; profile_id: string; display_name: string; class_name: string | null; books: number; points: number };

export default async function Dashboard() {
  const user = await requireStaffArea();
  const db = await getServerClient();
  const nowIso = new Date().toISOString();
  const now = requestNow();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [active, overdue, requests, pendingReturns, students, copies, recent, overdueRows, leaders, notifications] =
    await Promise.all([
      count(db.from("loans").select("id", { count: "exact", head: true }).eq("status", "active")),
      count(db.from("loans").select("id", { count: "exact", head: true }).eq("status", "active").lt("due_at", nowIso)),
      count(db.from("loan_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
      count(db.from("loans").select("id", { count: "exact", head: true }).eq("status", "return_pending")),
      count(db.from("profiles").select("id", { count: "exact", head: true }).eq("kind", "student").eq("is_active", true)),
      count(db.from("book_copies").select("id", { count: "exact", head: true }).eq("condition", "active")),
      db.from("loans").select(LOAN_COLUMNS).order("borrowed_at", { ascending: false }).limit(8),
      db.from("loans").select(LOAN_COLUMNS).eq("status", "active").lt("due_at", nowIso).order("due_at").limit(6),
      db.rpc("leaderboard", { p_kind: "student", p_from: monthStart.toISOString(), p_to: null, p_class_id: null, p_limit: 5 }),
      db
        .from("notifications")
        .select("id, kind, payload, created_at, read_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const recentLoans = (recent.data ?? []) as LoanRow[];
  const overdueLoans = (overdueRows.data ?? []) as LoanRow[];
  const all = [...recentLoans, ...overdueLoans];
  const [books, people] = await Promise.all([
    booksById(db, all.map((l) => l.book_id)),
    peopleById(db, all.map((l) => l.borrower_id)),
  ]);
  const top = ((leaders.data ?? []) as Leader[]).filter((l) => l.place <= 5).slice(0, 5);

  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", timeZone: "Asia/Tashkent" }).format(new Date()));
  const greeting = hour < 11 ? "Xayrli tong" : hour < 17 ? "Xayrli kun" : "Xayrli kech";

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{fmtDate(new Date())}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
            {greeting}, {user.firstName}!
          </h1>
          <p className="mt-1 text-muted">{user.schoolName} kutubxonasining bugungi holati.</p>
        </div>
        {user.isCirculator && (
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/kutubxonachi/berish">
              <BookUp className="size-4" /> Kitob berish
            </LinkButton>
            <LinkButton href="/kutubxonachi/qabul" variant="secondary">
              <BookDown className="size-4" /> Qabul qilish
            </LinkButton>
          </div>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="O'quvchilarda" value={num(active)} hint="faol qarzlar" icon={BookCopy} href="/kutubxonachi/qarzlar" />
        <StatCard
          label="Muddati o'tgan"
          value={num(overdue)}
          hint="qaytarilmagan kitoblar"
          icon={TriangleAlert}
          tone={overdue ? "bad" : "ok"}
          href="/kutubxonachi/qarzlar?f=overdue"
        />
        <StatCard
          label="So'rovlar"
          value={num(requests + (user.isLibrarian ? pendingReturns : 0))}
          hint={user.isLibrarian ? `${requests} so'rov · ${pendingReturns} tasdiq` : "kutilmoqda"}
          icon={Inbox}
          tone={requests + pendingReturns ? "gold" : "neutral"}
          href={user.isCirculator ? "/kutubxonachi/sorovlar" : undefined}
        />
        <StatCard label="O'quvchilar" value={num(students)} hint={`${num(copies)} ta kitob nusxasi`} icon={Users} tone="neutral" href="/kutubxonachi/oquvchilar" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            icon={CalendarClock}
            title="So'nggi harakatlar"
            action={
              <Link href="/kutubxonachi/qarzlar" className="text-sm font-semibold text-brand-700 hover:underline">
                Hammasi
              </Link>
            }
          />
          {recentLoans.length === 0 ? (
            <EmptyState icon={BookCopy} title="Hali kitob berilmagan" description="Birinchi kitobni berish uchun «Kitob berish» bo'limiga o'ting." />
          ) : (
            <ul className="divide-y divide-line/60">
              {recentLoans.map((l) => {
                const p = people.get(l.borrower_id);
                return (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3.5">
                    {p && <Avatar text={initials(p)} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{books.get(l.book_id)?.title ?? "—"}</p>
                      <p className="truncate text-xs text-muted">
                        {fullName(p)} · {fmtDateTime(l.status === "active" ? l.borrowed_at : l.return_recorded_at)}
                      </p>
                    </div>
                    {l.status === "active" ? (
                      <Badge tone="brand">Berildi</Badge>
                    ) : l.status === "return_pending" ? (
                      <Badge tone="warn">Tasdiq kutilmoqda</Badge>
                    ) : (
                      <Badge tone="ok">Qaytarildi</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={Medal} title="Oyning eng faol kitobxonlari" />
            {top.length === 0 ? (
              <EmptyState icon={Medal} title="Bu oy hali natija yo'q" />
            ) : (
              <ol className="divide-y divide-line/60">
                {top.map((r) => (
                  <li key={r.profile_id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className={
                        r.place === 1
                          ? "grid size-8 place-items-center rounded-full bg-gold-500 text-sm font-bold text-brand-900"
                          : "grid size-8 place-items-center rounded-full bg-paper-2 text-sm font-bold text-muted"
                      }
                    >
                      {r.place}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{r.display_name}</p>
                      <p className="text-xs text-muted">
                        {r.class_name ?? "—"} · {r.books} kitob
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-brand-700">{num(r.points)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader
              icon={TriangleAlert}
              title="Muddati o'tganlar"
              action={
                overdue > 0 && (
                  <Link href="/kutubxonachi/qarzlar?f=overdue" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                    {overdue} <ArrowRight className="size-4" />
                  </Link>
                )
              }
            />
            {overdueLoans.length === 0 ? (
              <EmptyState icon={TriangleAlert} title="Kechikkan kitob yo'q" description="Barcha kitoblar o'z vaqtida." />
            ) : (
              <ul className="divide-y divide-line/60">
                {overdueLoans.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{fullName(people.get(l.borrower_id))}</p>
                      <p className="truncate text-xs text-muted">{books.get(l.book_id)?.title}</p>
                    </div>
                    <Badge tone="bad">{-daysUntil(l.due_at, now)} kun</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon={Bell} title="Bildirishnomalar" />
            <NotificationList items={notifications.data ?? []} />
          </Card>
        </div>
      </div>
    </>
  );
}
