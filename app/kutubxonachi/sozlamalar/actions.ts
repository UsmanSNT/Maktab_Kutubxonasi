"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, type FormState } from "@/lib/errors";
import { getServerClient } from "@/lib/supabase/server";

const NO_ACCESS = { error: errorMessage({ message: "forbidden" }) };

const int = (min: number, max: number, label: string) =>
  z.coerce.number().int(`${label}: butun son`).min(min, `${label}: kamida ${min}`).max(max, `${label}: ko'pi bilan ${max}`);

const settingsSchema = z.object({
  loan_days: int(1, 120, "Qarz muddati"),
  min_hold_days: int(0, 30, "Minimal o'qish muddati"),
  min_pages: int(0, 100000, "Minimal sahifalar"),
  quiz_start_window_minutes: int(1, 1440, "Testni boshlash oynasi"),
  quiz_seconds_per_question: int(5, 600, "Savol vaqti"),
  quiz_network_grace_seconds: int(0, 60, "Tarmoq zaxirasi"),
  quiz_questions_per_attempt: int(1, 50, "Savollar soni"),
  quiz_max_exits: int(1, 20, "Chiqishlar soni"),
  base_points_per_book: int(0, 1000, "Kitob bali"),
  quiz_points_max: int(0, 1000, "Test bali"),
  class_points_cap: int(1, 100000, "Sinf cheklovi"),
  overdue_notice_every_days: int(1, 30, "Eslatma oralig'i"),
});

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NO_ACCESS;
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await getServerClient();
  const { error } = await db
    .from("school_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("school_id", user.schoolId);
  if (error) return { error: errorMessage(error) };
  refresh();
  return { message: "Sozlamalar saqlandi" };
}

export async function saveSchool(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NO_ACCESS;
  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency_name") ?? "").trim();
  if (!name) return { error: "Maktab nomini kiriting" };
  if (!currency || currency.length > 32) return { error: "Valyuta nomi 1–32 belgi" };
  const db = await getServerClient();
  const { error } = await db.from("schools").update({ name, currency_name: currency }).eq("id", user.schoolId);
  if (error) return { error: errorMessage(error) };
  refresh();
  return { message: "Saqlandi" };
}

export async function saveMilestone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NO_ACCESS;
  const books = Number(formData.get("books"));
  const reward = Number(formData.get("reward_total"));
  const minAvg = Number(formData.get("min_avg"));
  if (!(Number.isInteger(books) && books > 0)) return { error: "Kitoblar soni musbat butun son" };
  if (!(Number.isInteger(reward) && reward >= 0)) return { error: "Mukofot 0 yoki undan katta" };
  if (!(minAvg >= 0 && minAvg <= 100)) return { error: "O'rtacha natija 0–100%" };
  const db = await getServerClient();
  const { error } = await db
    .from("milestones")
    .upsert({ school_id: user.schoolId, books, reward_total: reward, min_avg_bp: Math.round(minAvg * 100) }, { onConflict: "school_id,books" });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { message: "Marra saqlandi" };
}

export async function deleteMilestone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NO_ACCESS;
  const db = await getServerClient();
  const { error } = await db.from("milestones").delete().eq("school_id", user.schoolId).eq("books", Number(formData.get("books")));
  if (error) return { error: errorMessage(error) };
  refresh();
  return {};
}
