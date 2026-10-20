// Bazadagi RPC xato kodlarini foydalanuvchiga tushunarli xabarga aylantiradi.
const MESSAGES: Record<string, string> = {
  not_authenticated: "Sessiya tugagan. Qaytadan kiring.",
  forbidden: "Bu amal uchun ruxsatingiz yo'q.",
  unknown_copy: "Bu QR kod bo'yicha kitob nusxasi topilmadi.",
  unknown_borrower: "O'quvchi topilmadi yoki hisobi faol emas.",
  unknown_profile: "Foydalanuvchi topilmadi.",
  unknown_book: "Kitob topilmadi.",
  unknown_request: "So'rov topilmadi.",
  copy_not_active: "Bu nusxa yo'qolgan yoki hisobdan chiqarilgan.",
  copy_already_on_loan: "Bu nusxa hozir boshqa o'quvchida.",
  copy_not_available: "Bu nusxa hozir bo'sh emas.",
  borrower_has_this_book: "O'quvchida shu kitobning boshqa nusxasi bor.",
  loan_id_conflict: "So'rov takrorlandi. Sahifani yangilab qayta urinib ko'ring.",
  no_open_loan: "Bu nusxa bo'yicha ochiq qarz yo'q.",
  return_already_recorded: "Qaytarish allaqachon qayd etilgan, kutubxonachi tasdig'i kutilmoqda.",
  invalid_loan_state: "Qarz holati bu amalga mos emas.",
  invalid_kind: "Noto'g'ri so'rov turi.",
  invalid_count: "Nusxalar soni 1 dan 100 gacha bo'lishi kerak.",
  stale_run: "Test holati o'zgardi. Sahifa yangilanadi.",
  no_open_question: "Ochiq savol qolmadi.",
  not_current_question: "Bu savol endi joriy emas.",
  invalid_option: "Noto'g'ri javob varianti.",
  quiz_bank_too_small: "Bu kitob bo'yicha savollar yetarli emas.",
  quiz_not_finished: "Test hali tugamagan.",
  attempt_not_found: "Test topilmadi.",
  question_needs_options: "Savolda kamida 2 ta variant bo'lishi kerak.",
  question_needs_answer_key: "To'g'ri javobni belgilang.",
  approved_question_is_locked: "Tasdiqlangan savolni o'zgartirib bo'lmaydi.",
};

type ErrorLike = { message?: string; code?: string } | null | undefined;

export function errorMessage(error: ErrorLike, fallback = "Xatolik yuz berdi. Qayta urinib ko'ring."): string {
  const raw = error?.message?.trim() ?? "";
  if (MESSAGES[raw]) return MESSAGES[raw];
  for (const [code, text] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) return text;
  }
  if (error?.code === "23505") return "Bunday yozuv allaqachon mavjud.";
  if (error?.code === "23514") return "Kiritilgan qiymat qoidalarga mos emas.";
  if (error?.code === "42501") return MESSAGES.forbidden;
  return fallback;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(error: string): ActionResult<T> {
  return { ok: false, error };
}

/** useActionState bilan ishlaydigan formalar holati. */
export type FormState = { error?: string; message?: string };
