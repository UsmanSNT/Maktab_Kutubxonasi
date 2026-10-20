import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, Bell, BookOpen, Coins, Flame, ListChecks, ScanLine, Timer, Trophy } from "lucide-react";
import { NotificationList, type NotificationRow } from "@/components/NotificationList";
import { Badge, Card, CardHeader, EmptyState, LinkButton, Progress, cn } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { daysUntil, fmtDate, fmtDateTime, num, pct, requestNow } from "@/lib/format";
import { booksById, LOAN_COLUMNS, type LoanRow } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";
import { markNotificationsRead } from "@/app/kutubxonachi/actions";

export const metadata: Metadata = { title: "Bosh sahifa" };

type MyProgress = {
  books: number;
  tests: number;
  avg_test_bp: number;
  points: number;
  coin_balance: number;
  next_milestone_books: number | null;
  next_milestone_total: number | null;
};

type OpenQuiz = { attempt_id: string; book_title: string; status: string; start_deadline: string; questions_total: number };

export default async function ReaderHome() {
  const user = await requireUser();
  const db = await getServerClient();
  const now = requestNow();

  const [{ data: progressData }, { data: loanData }, { data: quizData }, { data: notes }, { data: reqData }, { data: milestones }] =
    await Promise.all([
      db.rpc("my_progress"),
      db.from("loans").select(LOAN_COLUMNS).eq("borrower_id", user.id).in("status", ["active", "return_pending"]).order("due_at"),
      db.rpc("my_quizzes"),
      db
        .from("notifications")
        .select("id, kind, payload, created_at, read_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      db.from("loan_requests").select("id, kind, copy_id, created_at").eq("requester_id", user.id).eq("status", "pending"),
      db.from("milestones").select("books, min_avg_bp").order("books"),
    ]);
  const p = ((progressData ?? []) as MyProgress[])[0] ?? {
    books: 0,
    tests: 0,
    avg_test_bp: 0,
    points: 0,
    coin_balance: 0,
    next_milestone_books: null,
    next_milestone_total: null,
  };
  const loans = (loanData ?? []) as LoanRow[];
  const quizzes = (quizData ?? []) as OpenQuiz[];
  const books = await booksById(db, loans.map((l) => l.book_id));
  const unread = (notes ?? []).filter((n) => !n.read_at).length;

  const prevMilestone = [...(milestones ?? [])].reverse().find((m) => m.books <= p.tests)?.books ?? 0;
  const nextBooks = p.next_milestone_books;
  const toNext = nextBooks ? Math.max(nextBooks - p.tests, 0) : 0;
  const progress = nextBooks ? ((p.tests - prevMilestone) / (nextBooks - prevMilestone)) * 100 : 100;
  const minAvg = (milestones ?? []).find((m) => m.books === nextBooks)?.min_avg_bp ?? 8000;

  return (
    <div className="space-y-6">
      {/* Salomlashish va asosiy ko'rsatkich */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-900 p-6 text-white shadow-pop sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-brand-600/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-brand-200">Salom,</p>
            <h1 className="text-3xl font-bold tracking-tight">{user.firstName}!</h1>
            <p className="mt-2 max-w-sm text-brand-100/85">
              {p.books === 0
                ? "Birinchi kitobingizni oling — sarguzasht shundan boshlanadi."
                : `Siz ${p.books} ta kitob o'qidingiz. Davom eting!`}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/15">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-200">
                <Trophy className="size-3.5" /> Ball
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{num(p.points)}</p>
            </div>
            <div className="rounded-2xl bg-gold-500 px-5 py-4 text-brand-900">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <Coins className="size-3.5" /> {user.currency}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{num(p.coin_balance)}</p>
            </div>
          </div>
        </div>

        {nextBooks && (
          <div className="relative mt-6 rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-semibold">
                <Award className="size-4 text-gold-400" /> Keyingi marra: {nextBooks} kitob
              </span>
              <span className="text-brand-200">
                +{num(p.next_milestone_total ?? 0)} {user.currency}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-gold-400" style={{ width: `${Math.max(4, Math.min(100, progress))}%` }} />
            </div>
            <p className="mt-2 text-xs text-brand-200">
              Yana {toNext} ta kitob o&apos;qib, testdan o&apos;rtacha {Math.round(minAvg / 100)}% va undan yuqori natija oling.
              Hozirgi o&apos;rtacha: {pct(p.avg_test_bp)}
            </p>
          </div>
        )}
      </section>

      {/* Ochiq testlar — eng muhim harakat */}
      {quizzes.length > 0 && (
        <div className="space-y-3">
          {quizzes.map((q) => (
            <Link
              key={q.attempt_id}
              href={`/o-quvchi/testlar/${q.attempt_id}`}
              className="group flex items-center gap-4 rounded-2xl border border-gold-400/60 bg-gold-50 p-4 transition-shadow hover:shadow-pop"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold-500 text-brand-900">
                <Flame className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">«{q.book_title}» bo&apos;yicha test</p>
                <p className="flex items-center gap-1.5 text-sm text-gold-700">
                  <Timer className="size-4" />
                  {q.status === "in_progress" ? "Davom ettiring" : `Boshlash muddati: ${fmtDateTime(q.start_deadline)}`}
                </p>
              </div>
              <ArrowRight className="size-5 text-gold-700 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "O'qilgan", value: num(p.books), icon: BookOpen, tone: "bg-brand-50 text-brand-700" },
          { label: "Testlar", value: num(p.tests), icon: ListChecks, tone: "bg-ok-50 text-ok-700" },
          { label: "O'rtacha natija", value: pct(p.avg_test_bp), icon: Trophy, tone: "bg-gold-50 text-gold-700" },
        ].map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-4">
            <span className={cn("grid size-11 place-items-center rounded-xl", s.tone)}>
              <s.icon className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted">{s.label}</p>
              <p className="text-xl font-bold tabular-nums text-ink">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            icon={BookOpen}
            title="Qo'limdagi kitoblar"
            action={
              <LinkButton href="/o-quvchi/skaner" size="sm" variant="secondary">
                <ScanLine className="size-4" /> Skaner
              </LinkButton>
            }
          />
          {loans.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Hozir qo'lingizda kitob yo'q"
              description="Katalogdan kitob tanlang va kutubxonadan oling."
              action={
                <LinkButton href="/o-quvchi/katalog" size="sm">
                  Katalogni ko&apos;rish
                </LinkButton>
              }
            />
          ) : (
            <ul className="divide-y divide-line/60">
              {loans.map((l) => {
                const d = daysUntil(l.due_at, now);
                const total = Math.max(1, daysUntil(l.due_at, new Date(l.borrowed_at).getTime()));
                return (
                  <li key={l.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{books.get(l.book_id)?.title}</p>
                        <p className="text-sm text-muted">{books.get(l.book_id)?.author}</p>
                      </div>
                      {l.status === "return_pending" ? (
                        <Badge tone="warn">Tasdiq kutilmoqda</Badge>
                      ) : d < 0 ? (
                        <Badge tone="bad">{-d} kun kechikdi</Badge>
                      ) : (
                        <Badge tone={d <= 2 ? "warn" : "brand"}>{d === 0 ? "Bugun qaytaring" : `${d} kun qoldi`}</Badge>
                      )}
                    </div>
                    {l.status === "active" && (
                      <div className="mt-3">
                        <Progress value={((total - Math.max(d, 0)) / total) * 100} tone={d < 0 ? "gold" : "brand"} />
                        <p className="mt-1.5 text-xs text-muted">Qaytarish muddati: {fmtDate(l.due_at)}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {(reqData ?? []).length > 0 && (
            <p className="border-t border-line/70 px-5 py-3 text-sm text-muted">
              {(reqData ?? []).length} ta so&apos;rovingiz kutubxonachi tasdig&apos;ini kutmoqda.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader
            icon={Bell}
            title="Xabarlar"
            action={
              unread > 0 && (
                <form action={markNotificationsRead}>
                  <button type="submit" className="text-sm font-semibold text-brand-700 hover:underline">
                    O&apos;qildi
                  </button>
                </form>
              )
            }
          />
          <NotificationList items={(notes ?? []) as NotificationRow[]} />
        </Card>
      </div>
    </div>
  );
}
