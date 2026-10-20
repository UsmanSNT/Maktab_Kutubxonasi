"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, fail, ok, type ActionResult, type FormState } from "@/lib/errors";
import { getServerClient } from "@/lib/supabase/server";

// Berish / qabul qilish amallari. Har bir qoida bazadagi RPC ichida tekshiriladi;
// bu yerda faqat sessiya borligi va natijaning ko'rinishi.

export type FoundProfile = {
  profile_id: string;
  first_name: string;
  last_name: string;
  kind: string;
  class_name: string | null;
  open_loans: { title: string; due_at: string }[];
};

export type FoundCopy = {
  copy_id: string;
  book_id: string;
  title: string;
  copy_no: number;
  condition: string;
  loan_id: string | null;
  loan_status: string | null;
  borrower_id: string | null;
  borrower_name: string | null;
  due_at: string | null;
};

async function session() {
  const user = await getCurrentUser();
  return user ? { user, db: await getServerClient() } : null;
}

export async function lookupProfile(code: string): Promise<ActionResult<FoundProfile>> {
  const s = await session();
  if (!s) return fail(errorMessage({ message: "not_authenticated" }));
  const { data, error } = await s.db.rpc("find_profile_by_code", { p_code: code });
  if (error) return fail(errorMessage(error));
  const row = (data as Omit<FoundProfile, "open_loans">[] | null)?.[0];
  if (!row) return fail("Karta topilmadi yoki bu o'quvchiga kitob berishga ruxsatingiz yo'q.");

  const { data: loans } = await s.db
    .from("loans")
    .select("book_id, due_at")
    .eq("borrower_id", row.profile_id)
    .in("status", ["active", "return_pending"]);
  const bookIds = (loans ?? []).map((l) => l.book_id as string);
  const { data: books } = bookIds.length
    ? await s.db.from("books").select("id, title").in("id", bookIds)
    : { data: [] as { id: string; title: string }[] };
  const titles = new Map((books ?? []).map((b) => [b.id as string, b.title as string]));

  return ok({
    ...row,
    open_loans: (loans ?? []).map((l) => ({ title: titles.get(l.book_id) ?? "—", due_at: l.due_at as string })),
  });
}

export async function lookupCopy(qr: string): Promise<ActionResult<FoundCopy>> {
  const s = await session();
  if (!s) return fail(errorMessage({ message: "not_authenticated" }));
  const { data, error } = await s.db.rpc("find_copy_by_qr", { p_qr: qr });
  if (error) return fail(errorMessage(error));
  const row = (data as FoundCopy[] | null)?.[0];
  if (!row) return fail(errorMessage({ message: "unknown_copy" }));
  return ok(row);
}

export async function issueLoan(input: {
  loanId: string;
  copyId: string;
  borrowerId: string;
  clientTs: string;
}): Promise<ActionResult<{ due_at: string }>> {
  const s = await session();
  if (!s) return fail(errorMessage({ message: "not_authenticated" }));
  const { data, error } = await s.db.rpc("issue_loan", {
    p_loan_id: input.loanId,
    p_copy_id: input.copyId,
    p_borrower_id: input.borrowerId,
    p_client_ts: input.clientTs,
  });
  if (error) return fail(errorMessage(error));
  refresh();
  return ok({ due_at: (data as { due_at: string }).due_at });
}

export type ReturnResult = {
  status: string;
  scored: boolean;
  not_scored_reason: string | null;
  quiz_offered: boolean;
};

export async function recordReturn(input: { opId: string; qr: string; clientTs: string }): Promise<ActionResult<ReturnResult>> {
  const s = await session();
  if (!s) return fail(errorMessage({ message: "not_authenticated" }));
  const { data, error } = await s.db.rpc("record_return", {
    p_op_id: input.opId,
    p_copy_qr: input.qr,
    p_client_ts: input.clientTs,
  });
  if (error) return fail(errorMessage(error));
  const loan = data as { id: string; status: string; scored: boolean; not_scored_reason: string | null };
  const { data: attempt } = await s.db
    .from("quiz_attempts")
    .select("id")
    .eq("loan_id", loan.id)
    .neq("status", "voided")
    .maybeSingle();
  refresh();
  return ok({
    status: loan.status,
    scored: loan.scored,
    not_scored_reason: loan.not_scored_reason,
    quiz_offered: !!attempt,
  });
}

export async function verifyReturn(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await session();
  if (!s) return { error: errorMessage({ message: "not_authenticated" }) };
  const accept = formData.get("accept") === "1";
  const { error } = await s.db.rpc("verify_return", {
    p_loan_id: String(formData.get("loan_id")),
    p_accept: accept,
    p_note: accept ? null : "Kitob kutubxonaga topshirilmagan",
  });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { message: accept ? "Tasdiqlandi" : "Rad etildi" };
}

export async function decideRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await session();
  if (!s) return { error: errorMessage({ message: "not_authenticated" }) };
  const approve = formData.get("approve") === "1";
  const { error } = await s.db.rpc("decide_loan_request", {
    p_request_id: String(formData.get("request_id")),
    p_approve: approve,
    p_loan_id: crypto.randomUUID(),
  });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { message: approve ? "Tasdiqlandi" : "Rad etildi" };
}

export async function markNotificationsRead(): Promise<void> {
  const s = await session();
  if (!s) return;
  await s.db.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", s.user.id).is("read_at", null);
  refresh();
}
