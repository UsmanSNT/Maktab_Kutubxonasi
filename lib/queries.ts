import "server-only";
import { getServerClient } from "@/lib/supabase/server";

// Bir nechta tashqi kalitli jadvallarda PostgREST embed noaniq bo'ladi, shuning uchun
// bog'liq yozuvlar id bo'yicha alohida olinib, xotirada birlashtiriladi.
export type Db = Awaited<ReturnType<typeof getServerClient>>;

export type BookLite = { id: string; title: string; author: string; pages: number };
export type PersonLite = { id: string; first_name: string; last_name: string; login_id: string; kind: string };

function uniq(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((x): x is string => !!x))];
}

export async function booksById(db: Db, ids: (string | null | undefined)[]): Promise<Map<string, BookLite>> {
  const list = uniq(ids);
  if (list.length === 0) return new Map();
  const { data } = await db.from("books").select("id, title, author, pages").in("id", list);
  return new Map((data ?? []).map((b: BookLite) => [b.id, b]));
}

export async function peopleById(db: Db, ids: (string | null | undefined)[]): Promise<Map<string, PersonLite>> {
  const list = uniq(ids);
  if (list.length === 0) return new Map();
  const { data } = await db.from("profiles").select("id, first_name, last_name, login_id, kind").in("id", list);
  return new Map((data ?? []).map((p: PersonLite) => [p.id, p]));
}

export async function copiesById(
  db: Db,
  ids: (string | null | undefined)[],
): Promise<Map<string, { id: string; book_id: string; copy_no: number }>> {
  const list = uniq(ids);
  if (list.length === 0) return new Map();
  const { data } = await db.from("book_copies").select("id, book_id, copy_no").in("id", list);
  return new Map((data ?? []).map((c: { id: string; book_id: string; copy_no: number }) => [c.id, c]));
}

export type ClassLite = { id: string; name: string; grade: number | null; homeroom_profile_id: string | null };

export async function currentYear(db: Db): Promise<{ id: string; label: string } | null> {
  const { data } = await db.from("academic_years").select("id, label").eq("is_current", true).maybeSingle();
  return data;
}

export async function currentClasses(db: Db): Promise<ClassLite[]> {
  const year = await currentYear(db);
  if (!year) return [];
  const { data } = await db
    .from("classes")
    .select("id, name, grade, homeroom_profile_id")
    .eq("academic_year_id", year.id)
    .order("grade", { ascending: true, nullsFirst: false })
    .order("name");
  return data ?? [];
}

/** O'quvchi id -> joriy o'quv yilidagi sinf. */
export async function classOfStudents(db: Db, studentIds: (string | null | undefined)[]): Promise<Map<string, ClassLite>> {
  const list = uniq(studentIds);
  const year = await currentYear(db);
  if (list.length === 0 || !year) return new Map();
  const [{ data: enr }, classes] = await Promise.all([
    db.from("enrollments").select("student_id, class_id").eq("academic_year_id", year.id).in("student_id", list),
    currentClasses(db),
  ]);
  const byId = new Map(classes.map((c) => [c.id, c]));
  const out = new Map<string, ClassLite>();
  for (const e of (enr ?? []) as { student_id: string; class_id: string }[]) {
    const c = byId.get(e.class_id);
    if (c) out.set(e.student_id, c);
  }
  return out;
}

export type LoanRow = {
  id: string;
  copy_id: string;
  book_id: string;
  borrower_id: string;
  status: "active" | "return_pending" | "returned";
  borrowed_at: string;
  due_at: string;
  return_recorded_at: string | null;
  return_verified_at: string | null;
  scored: boolean;
  not_scored_reason: string | null;
  base_points: number | null;
};

export const LOAN_COLUMNS =
  "id, copy_id, book_id, borrower_id, status, borrowed_at, due_at, return_recorded_at, return_verified_at, scored, not_scored_reason, base_points";

export const NOT_SCORED_REASON: Record<string, string> = {
  too_few_pages: "Kitob sahifalari kam",
  held_too_briefly: "Juda qisqa muddat o'qilgan",
  book_already_counted: "Bu kitob avval hisoblangan",
};
