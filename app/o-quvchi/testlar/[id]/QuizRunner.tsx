"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, Hourglass, Loader2, LogOut, Timer, Trophy, TriangleAlert } from "lucide-react";
import { Alert, Card, buttonClass, cn } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { quizAnswer, quizExit, quizNext, quizOpen, quizStart, type QuizQuestion, type QuizState } from "../../actions";

type Phase =
  | { name: "loading" }
  | { name: "intro"; state: QuizState; notice?: string }
  | { name: "question"; state: QuizState; q: QuizQuestion; left: number }
  | { name: "result"; state: QuizState }
  | { name: "closed"; state: QuizState }
  | { name: "error"; message: string };

const LETTERS = "ABCDEF";

// Test ekrani. Vaqt, savollar va to'g'ri javoblar faqat serverda; bu yerda faqat ko'rsatish.
// Sahifadan chiqish (boshqa ilovaga o'tish) serverga "chiqish" deb yuboriladi.
export function QuizRunner({ attemptId, bookTitle }: { attemptId: string; bookTitle: string }) {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [busy, setBusy] = useState(false);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const show = useCallback((state: QuizState, notice?: string) => {
    if (state.status === "completed") setPhase({ name: "result", state });
    else if (state.status === "pending") setPhase({ name: "intro", state, notice });
    else if (state.status === "in_progress") return true;
    else setPhase({ name: "closed", state });
    return false;
  }, []);

  const loadNext = useCallback(
    async (state: QuizState) => {
      const res = await quizNext(attemptId, state.run_no);
      if (!res.ok) {
        const reopened = await quizOpen(attemptId);
        if (reopened.ok) show(reopened.data, res.error);
        else setPhase({ name: "error", message: res.error });
        return;
      }
      if (res.data.finished) show(res.data.state);
      else setPhase({ name: "question", state, q: res.data, left: res.data.seconds_left });
    },
    [attemptId, show],
  );

  // Birinchi ochilish: sahifa yangilangan bo'lsa (davom etayotgan test), bu chiqish deb sanaladi.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const opened = await quizOpen(attemptId);
      if (cancelled) return;
      if (!opened.ok) return setPhase({ name: "error", message: opened.error });
      let state = opened.data;
      let notice: string | undefined;
      if (state.status === "in_progress") {
        const resumed = await quizStart(attemptId, true);
        if (cancelled) return;
        if (!resumed.ok) return setPhase({ name: "error", message: resumed.error });
        if (resumed.data.exits > state.exits) notice = "Testdan chiqqaningiz qayd etildi. Savollar yangidan beriladi.";
        state = resumed.data;
      }
      if (show(state, notice)) await loadNext(state);
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId, loadNext, show]);

  // Teskari sanoq
  const ticking = phase.name === "question";
  useEffect(() => {
    if (!ticking) return;
    const t = window.setInterval(() => {
      setPhase((p) => (p.name === "question" && p.left > 0 ? { ...p, left: p.left - 1 } : p));
    }, 1000);
    return () => window.clearInterval(t);
  }, [ticking]);

  const answer = useCallback(
    async (optionId: string | null) => {
      const p = phaseRef.current;
      if (p.name !== "question" || busy) return;
      setBusy(true);
      const res = await quizAnswer(attemptId, p.state.run_no, p.q.question_id, optionId);
      if (!res.ok) {
        setBusy(false);
        const reopened = await quizOpen(attemptId);
        if (reopened.ok && show(reopened.data, res.error)) await loadNext(reopened.data);
        else if (!reopened.ok) setPhase({ name: "error", message: res.error });
        return;
      }
      if (res.data.finished || res.data.state.status !== "in_progress") show(res.data.state);
      else await loadNext(res.data.state);
      setBusy(false);
    },
    [attemptId, busy, loadNext, show],
  );

  // Vaqt tugadi -> javobsiz yuboriladi (noto'g'ri deb hisoblanadi)
  const timeUp = phase.name === "question" && phase.left === 0;
  useEffect(() => {
    if (timeUp) answer(null);
  }, [timeUp, answer]);

  // Boshqa ilova/tabga o'tish
  useEffect(() => {
    const onHide = async () => {
      const p = phaseRef.current;
      if (document.visibilityState !== "hidden" || p.name !== "question") return;
      const res = await quizExit(attemptId, p.state.run_no);
      if (res.ok) show(res.data, "Siz testdan chiqdingiz. Bu chiqish hisobga olindi.");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [attemptId, show]);

  const start = async () => {
    if (phase.name !== "intro") return;
    setBusy(true);
    const res = await quizStart(attemptId, false);
    if (!res.ok) {
      setBusy(false);
      return setPhase({ name: "error", message: res.error });
    }
    if (show(res.data)) await loadNext(res.data);
    setBusy(false);
  };

  // -------------------------------------------------------------------------

  if (phase.name === "loading") {
    return (
      <Card className="grid place-items-center p-16">
        <Loader2 className="size-8 animate-spin text-brand-600" />
      </Card>
    );
  }

  if (phase.name === "error") {
    return (
      <Card className="space-y-4 p-6">
        <Alert>{phase.message}</Alert>
        <Link href="/o-quvchi/testlar" className={buttonClass("secondary")}>
          Testlarga qaytish
        </Link>
      </Card>
    );
  }

  if (phase.name === "intro") {
    const s = phase.state;
    return (
      <Card className="overflow-hidden">
        <div className="bg-brand-900 p-6 text-white">
          <p className="text-sm text-brand-200">Kitob bo&apos;yicha test</p>
          <h2 className="mt-1 text-2xl font-bold">{bookTitle}</h2>
        </div>
        <div className="space-y-5 p-6">
          {phase.notice && <Alert tone="warn">{phase.notice}</Alert>}
          <ul className="grid gap-3 sm:grid-cols-3">
            <Rule icon={Trophy} title={`${s.questions_total} ta savol`} text="Har biri bitta to'g'ri javobli" />
            <Rule icon={Timer} title={`${s.seconds_per_question} soniya`} text="Har bir savolga" />
            <Rule icon={LogOut} title={`${s.exits_left} marta`} text="Chiqishga ruxsat qoldi" />
          </ul>
          <div className="rounded-xl bg-paper p-4 text-sm text-muted">
            <p>
              • Testni <b className="text-ink">{fmtDateTime(s.start_deadline)}</b> gacha boshlang.
            </p>
            <p>• Test davomida boshqa ilova yoki oynaga o&apos;tmang — bu chiqish deb sanaladi va savollar almashadi.</p>
            <p>• Vaqt tugasa, savol javobsiz qoladi.</p>
          </div>
          <button type="button" onClick={start} disabled={busy} className={buttonClass("primary", "lg", "w-full")}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {s.run_no > 0 ? "Testni qayta boshlash" : "Testni boshlash"}
          </button>
        </div>
      </Card>
    );
  }

  if (phase.name === "result") {
    const r = phase.state.result!;
    const p = Math.round(r.score_bp / 100);
    const great = p >= 80;
    return (
      <Card className="overflow-hidden text-center">
        <div className={cn("p-8 text-white", great ? "bg-gradient-to-br from-gold-500 to-gold-700" : "bg-brand-900")}>
          <Trophy className="mx-auto size-12" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-widest opacity-80">Natija</p>
          <p className="mt-1 text-6xl font-bold tabular-nums">{p}%</p>
          <p className="mt-2 text-lg">
            {r.correct} / {r.total} to&apos;g&apos;ri javob
          </p>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-muted">
            {great ? "Ajoyib! Kitobni diqqat bilan o'qigansiz." : p >= 50 ? "Yaxshi natija! Keyingi kitobda yanada yuqoriroq." : "Keyingi safar kitobni sinchiklab o'qing — omad!"}
          </p>
          <Link href="/o-quvchi" className={buttonClass("primary", "lg", "w-full")}>
            Bosh sahifaga
          </Link>
        </div>
      </Card>
    );
  }

  if (phase.name === "closed") {
    const st = phase.state.status;
    return (
      <Card className="space-y-4 p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-warn-50 text-warn-600">
          {st === "expired" ? <Hourglass className="size-7" /> : <TriangleAlert className="size-7" />}
        </span>
        <h2 className="text-xl font-bold text-ink">
          {st === "expired" ? "Test muddati tugagan" : st === "cancelled_exits" ? "Test bekor qilindi" : "Test yopilgan"}
        </h2>
        <p className="text-muted">
          {st === "expired"
            ? "Testni belgilangan vaqt ichida boshlash kerak edi. Kitob uchun bazaviy ball baribir hisoblanadi."
            : st === "cancelled_exits"
              ? "Ilovadan juda ko'p marta chiqildi. Kitob uchun bazaviy ball saqlanadi."
              : "Bu test endi mavjud emas."}
        </p>
        <Link href="/o-quvchi" className={buttonClass("secondary")}>
          Bosh sahifaga
        </Link>
      </Card>
    );
  }

  // Savol
  const { q, left, state } = phase;
  const ratio = left / state.seconds_per_question;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {Array.from({ length: q.total }, (_, i) => (
            <span
              key={i}
              className={cn("h-1.5 w-5 rounded-full sm:w-7", i < q.position - 1 ? "bg-brand-600" : i === q.position - 1 ? "bg-gold-500" : "bg-paper-2")}
            />
          ))}
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums",
            ratio <= 0.25 ? "bg-bad-50 text-bad-600" : "bg-brand-50 text-brand-700",
          )}
        >
          <Timer className="size-4" /> {left}s
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="h-1 bg-paper-2">
          <div
            className={cn("h-full transition-[width] duration-1000 ease-linear", ratio <= 0.25 ? "bg-bad-600" : "bg-brand-600")}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <div className="p-6">
          <p className="text-sm font-semibold text-muted">
            Savol {q.position} / {q.total}
          </p>
          <h2 className="mt-2 text-xl font-bold leading-snug text-ink sm:text-2xl">{q.body}</h2>
          <div className="mt-6 grid gap-3">
            {q.options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                disabled={busy}
                onClick={() => answer(o.id)}
                className={cn(
                  "group flex items-center gap-4 rounded-2xl border-2 border-line bg-white p-4 text-left transition-all",
                  "hover:border-brand-500 hover:bg-brand-50/40 active:scale-[0.99] disabled:opacity-60",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper-2 font-bold text-muted group-hover:bg-brand-700 group-hover:text-white">
                  {LETTERS[i]}
                </span>
                <span className="font-medium text-ink">{o.body}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
      <p className="flex items-center justify-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <CircleCheck className="size-3.5" /> Javob darhol saqlanadi
        </span>
        <span className="flex items-center gap-1">
          <CircleX className="size-3.5" /> Oynadan chiqmang
        </span>
      </p>
    </div>
  );
}

function Rule({ icon: Icon, title, text }: { icon: typeof Timer; title: string; text: string }) {
  return (
    <li className="rounded-xl border border-line/70 p-4">
      <Icon className="size-5 text-brand-700" />
      <p className="mt-2 font-bold text-ink">{title}</p>
      <p className="text-xs text-muted">{text}</p>
    </li>
  );
}
