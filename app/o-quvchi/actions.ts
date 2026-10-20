"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/errors";
import { getServerClient } from "@/lib/supabase/server";

async function db() {
  const user = await getCurrentUser();
  return user ? getServerClient() : null;
}

const NO_SESSION = errorMessage({ message: "not_authenticated" });

export async function createRequest(kind: "borrow" | "return", qr: string): Promise<ActionResult<{ title: string }>> {
  const client = await db();
  if (!client) return fail(NO_SESSION);
  const { data, error } = await client.rpc("create_loan_request", { p_kind: kind, p_copy_qr: qr });
  if (error) return fail(errorMessage(error));
  const { data: copy } = await client.from("book_copies").select("book_id").eq("id", (data as { copy_id: string }).copy_id).maybeSingle();
  const { data: book } = copy ? await client.from("books").select("title").eq("id", copy.book_id).maybeSingle() : { data: null };
  refresh();
  return ok({ title: (book?.title as string) ?? "Kitob" });
}

// ---------------------------------------------------------------------------
// Test: barcha holat serverda. Mijoz faqat ko'rsatadi.
// ---------------------------------------------------------------------------

export type QuizState = {
  attempt_id: string;
  status: "pending" | "in_progress" | "completed" | "cancelled_exits" | "expired" | "voided";
  run_no: number;
  exits: number;
  max_exits: number;
  exits_left: number;
  start_deadline: string;
  questions_total: number;
  seconds_per_question: number;
  result: { correct: number; total: number; score_bp: number } | null;
};

export type QuizQuestion = {
  finished: false;
  position: number;
  total: number;
  question_id: string;
  body: string;
  options: { id: string; body: string }[];
  seconds_left: number;
};

type Next = QuizQuestion | { finished: true; state: QuizState };

async function call<T>(fn: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  const client = await db();
  if (!client) return fail(NO_SESSION);
  const { data, error } = await client.rpc(fn, args);
  if (error) return fail(errorMessage(error));
  return ok(data as T);
}

export async function quizOpen(attemptId: string) {
  return call<QuizState>("quiz_open", { p_attempt_id: attemptId });
}

export async function quizStart(attemptId: string, freshLoad: boolean) {
  return call<QuizState>("quiz_start_or_resume", { p_attempt_id: attemptId, p_fresh_load: freshLoad });
}

export async function quizNext(attemptId: string, runNo: number) {
  return call<Next>("quiz_next_question", { p_attempt_id: attemptId, p_run_no: runNo });
}

export async function quizAnswer(attemptId: string, runNo: number, questionId: string, optionId: string | null) {
  return call<{ accepted: boolean; timed_out: boolean; finished: boolean; state: QuizState }>("quiz_answer", {
    p_attempt_id: attemptId,
    p_run_no: runNo,
    p_question_id: questionId,
    p_option_id: optionId,
  });
}

export async function quizExit(attemptId: string, runNo: number) {
  return call<QuizState>("quiz_report_exit", { p_attempt_id: attemptId, p_run_no: runNo });
}
