import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Flame, History, ListChecks, Timer } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime, pct } from "@/lib/format";
import { booksById } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Testlar" };

type OpenQuiz = {
  attempt_id: string;
  book_title: string;
  status: string;
  start_deadline: string;
  questions_total: number;
  seconds_per_question: number;
  exits: number;
  max_exits: number;
};

type Attempt = { id: string; book_id: string; status: string; score_bp: number | null; correct_count: number | null; questions_total: number; finished_at: string | null; created_at: string };

const STATUS: Record<string, { label: string; tone: "ok" | "neutral" | "bad" | "warn" }> = {
  completed: { label: "Yakunlangan", tone: "ok" },
  expired: { label: "Muddati o'tgan", tone: "neutral" },
  cancelled_exits: { label: "Bekor qilingan", tone: "bad" },
  voided: { label: "Bekor qilingan", tone: "neutral" },
  pending: { label: "Kutilmoqda", tone: "warn" },
  in_progress: { label: "Jarayonda", tone: "warn" },
};

export default async function QuizzesPage() {
  const user = await requireUser();
  const db = await getServerClient();
  const [{ data: openData }, { data: histData }] = await Promise.all([
    db.rpc("my_quizzes"),
    db
      .from("quiz_attempts")
      .select("id, book_id, status, score_bp, correct_count, questions_total, finished_at, created_at")
      .eq("student_id", user.id)
      .not("status", "in", "(pending,in_progress,voided)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const open = (openData ?? []) as OpenQuiz[];
  const history = (histData ?? []) as Attempt[];
  const books = await booksById(db, history.map((a) => a.book_id));

  return (
    <>
      <PageHeader title="Testlar" description="Kitobni qaytargach, u bo'yicha test ochiladi. Test ballingizni oshiradi." />

      <div className="space-y-6">
        {open.length === 0 ? (
          <Card>
            <EmptyState
              icon={ListChecks}
              title="Hozir ochiq test yo'q"
              description="Kitobni o'qib qaytaring — kutubxonachi qabul qilgach, test shu yerda paydo bo'ladi."
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {open.map((q) => (
              <Link
                key={q.attempt_id}
                href={`/o-quvchi/testlar/${q.attempt_id}`}
                className="group rounded-2xl border border-gold-400/60 bg-gradient-to-br from-gold-50 to-white p-5 shadow-card transition-shadow hover:shadow-pop"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-gold-500 text-brand-900">
                    <Flame className="size-5" />
                  </span>
                  <ArrowRight className="size-5 text-gold-700 transition-transform group-hover:translate-x-1" />
                </div>
                <p className="mt-4 text-lg font-bold text-ink">{q.book_title}</p>
                <p className="mt-1 text-sm text-muted">
                  {q.questions_total} savol · har biriga {q.seconds_per_question} soniya
                </p>
                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-gold-700">
                  <Timer className="size-4" />
                  {q.status === "in_progress" ? "Jarayonda — davom ettiring" : `${fmtDateTime(q.start_deadline)} gacha boshlang`}
                </p>
              </Link>
            ))}
          </div>
        )}

        <Card>
          <CardHeader icon={History} title="Natijalarim" />
          {history.length === 0 ? (
            <EmptyState icon={History} title="Hali test ishlanmagan" />
          ) : (
            <ul className="divide-y divide-line/60">
              {history.map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{books.get(a.book_id)?.title ?? "—"}</p>
                    <p className="text-xs text-muted">{fmtDate(a.finished_at ?? a.created_at)}</p>
                  </div>
                  {a.status === "completed" ? (
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums text-ink">{pct(a.score_bp)}</p>
                      <p className="text-xs text-muted">
                        {a.correct_count}/{a.questions_total}
                      </p>
                    </div>
                  ) : (
                    <Badge tone={STATUS[a.status]?.tone ?? "neutral"}>{STATUS[a.status]?.label ?? a.status}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
