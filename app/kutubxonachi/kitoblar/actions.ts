"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, type FormState } from "@/lib/errors";
import { getServerClient } from "@/lib/supabase/server";

const NO_ACCESS: FormState = { error: errorMessage({ message: "forbidden" }) };

const bookSchema = z.object({
  title: z.string().trim().min(1, "Kitob nomini kiriting").max(300),
  author: z.string().trim().max(200).default(""),
  isbn: z.string().trim().max(32).optional(),
  pages: z.coerce.number().int("Sahifalar soni butun son bo'lsin").min(1, "Sahifalar sonini kiriting"),
  language: z.enum(["uz", "ru", "en", "kk", "tg", "other"]).default("uz"),
  copies: z.coerce.number().int().min(0).max(100).default(1),
});

export async function createBook(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const parsed = bookSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { copies, isbn, ...book } = parsed.data;

  const db = await getServerClient();
  const { data, error } = await db
    .from("books")
    .insert({ ...book, isbn: isbn || null, school_id: user.schoolId })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "Bu ISBN bilan kitob allaqachon bor." : errorMessage(error) };

  if (copies > 0) {
    const { error: copyError } = await db.rpc("add_book_copies", { p_book_id: data.id, p_count: copies });
    if (copyError) return { error: errorMessage(copyError) };
  }
  redirect(`/kutubxonachi/kitoblar/${data.id}`);
}

export async function updateBook(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const parsed = bookSchema.omit({ copies: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await getServerClient();
  const { error } = await db
    .from("books")
    .update({ ...parsed.data, isbn: parsed.data.isbn || null })
    .eq("id", String(formData.get("book_id")));
  if (error) return { error: errorMessage(error) };
  refresh();
  return { message: "Saqlandi" };
}

export async function addCopies(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const count = Number(formData.get("count"));
  const db = await getServerClient();
  const { data, error } = await db.rpc("add_book_copies", { p_book_id: String(formData.get("book_id")), p_count: count });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { message: `${(data as unknown[]).length} ta nusxa qo'shildi. Yorliqlarni chop eting.` };
}

export async function setCopyCondition(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const condition = String(formData.get("condition"));
  if (!["active", "lost", "withdrawn"].includes(condition)) return { error: "Noto'g'ri holat" };
  const db = await getServerClient();
  const { error } = await db.from("book_copies").update({ condition }).eq("id", String(formData.get("copy_id")));
  if (error) return { error: errorMessage(error) };
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Test savollari
// ---------------------------------------------------------------------------

export async function createQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isQuizEditor) return NO_ACCESS;

  const bookId = String(formData.get("book_id"));
  const body = String(formData.get("body") ?? "").trim();
  const options = formData
    .getAll("option")
    .map((o) => String(o).trim())
    .filter(Boolean);
  const correct = Number(formData.get("correct"));
  const approve = formData.get("approve") === "on";

  if (body.length < 3) return { error: "Savol matnini kiriting." };
  if (options.length < 2) return { error: "Kamida 2 ta javob varianti kiriting." };
  if (!(correct >= 0 && correct < options.length)) return { error: "To'g'ri javobni belgilang." };
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return { error: "Variantlar takrorlanmasin." };

  const db = await getServerClient();
  const { data: q, error } = await db
    .from("quiz_questions")
    .insert({ school_id: user.schoolId, book_id: bookId, body, status: "draft", created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: errorMessage(error) };

  // Variantlar, javob kaliti, so'ng (ixtiyoriy) tasdiqlash. Xato bo'lsa savol o'chiriladi.
  const fail = async (e: { message?: string; code?: string }) => {
    await db.from("quiz_questions").delete().eq("id", q.id);
    return { error: errorMessage(e) };
  };
  const { data: opts, error: optError } = await db
    .from("quiz_options")
    .insert(options.map((o) => ({ question_id: q.id, body: o })))
    .select("id, body");
  if (optError || !opts) return fail(optError ?? {});
  const correctId = opts.find((o) => o.body === options[correct])?.id;
  const { error: keyError } = await db.from("quiz_answer_keys").insert({ question_id: q.id, correct_option_id: correctId });
  if (keyError) return fail(keyError);

  if (approve) {
    const { error: apprError } = await db.from("quiz_questions").update({ status: "approved" }).eq("id", q.id);
    if (apprError) return { error: errorMessage(apprError) };
  }
  refresh();
  return { message: approve ? "Savol qo'shildi va tasdiqlandi" : "Savol qoralama sifatida saqlandi" };
}

export async function setQuestionStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isQuizEditor) return NO_ACCESS;
  const status = String(formData.get("status"));
  if (!["draft", "approved", "retired"].includes(status)) return { error: "Noto'g'ri holat" };
  const db = await getServerClient();
  const patch = status === "draft" ? { status, approved_by: null, approved_at: null } : { status };
  const { error } = await db.from("quiz_questions").update(patch).eq("id", String(formData.get("question_id")));
  if (error) return { error: errorMessage(error) };
  refresh();
  return {};
}

export async function deleteQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isQuizEditor) return NO_ACCESS;
  const db = await getServerClient();
  const { error } = await db.from("quiz_questions").delete().eq("id", String(formData.get("question_id"))).eq("status", "draft");
  if (error) {
    return { error: error.code === "23503" ? "Savol testlarda ishlatilgan — o'chirib bo'lmaydi, arxivlang." : errorMessage(error) };
  }
  refresh();
  return {};
}
