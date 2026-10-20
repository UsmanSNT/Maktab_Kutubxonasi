"use server";

import { randomBytes, randomInt } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { authEmail, getCurrentUser, type Role } from "@/lib/auth";
import { errorMessage, type FormState } from "@/lib/errors";
import { currentYear } from "@/lib/queries";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerClient } from "@/lib/supabase/server";

const NO_ACCESS = { error: errorMessage({ message: "forbidden" }) };

export type CodeState = FormState & { code?: string; login?: string; name?: string };

const personSchema = z.object({
  first_name: z.string().trim().min(1, "Ismni kiriting").max(60),
  last_name: z.string().trim().min(1, "Familiyani kiriting").max(60),
  login_id: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^([a-z0-9-]{3,32})?$/, "ID: 3–32 ta lotin harfi, raqam yoki chiziqcha")
    .optional(),
  kind: z.enum(["student", "teacher", "staff"]).default("student"),
  class_id: z.string().uuid().optional().or(z.literal("")),
});

// Yangi foydalanuvchi: Auth hisob (tasodifiy parol) + profil + sinf + bir martalik faollashtirish kodi.
// Parol hech kimga ko'rsatilmaydi: o'quvchi kod orqali o'zi o'rnatadi.
export async function createPerson(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const parsed = personSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data;
  const admin = getAdminClient();

  let login = p.login_id || "";
  if (!login) {
    for (let i = 0; i < 10 && !login; i++) {
      const candidate = String(randomInt(100000, 1000000));
      const { data } = await admin
        .from("profiles")
        .select("id")
        .eq("school_id", user.schoolId)
        .eq("login_id", candidate)
        .maybeSingle();
      if (!data) login = candidate;
    }
    if (!login) return { error: "ID yaratib bo'lmadi, qayta urinib ko'ring." };
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: authEmail(user.schoolCode, login),
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
  });
  if (authError || !created.user) {
    return { error: authError?.message?.includes("already") ? "Bu ID band. Boshqasini kiriting." : "Hisob yaratib bo'lmadi." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    school_id: user.schoolId,
    kind: p.kind,
    login_id: login,
    first_name: p.first_name,
    last_name: p.last_name,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.code === "23505" ? "Bu ID band. Boshqasini kiriting." : errorMessage(profileError) };
  }

  const db = await getServerClient();
  if (p.class_id && p.kind === "student") {
    const year = await currentYear(db);
    if (year) {
      await db.from("enrollments").insert({
        school_id: user.schoolId,
        student_id: created.user.id,
        class_id: p.class_id,
        academic_year_id: year.id,
      });
    }
  }

  const { data: code, error: codeError } = await db.rpc("issue_activation_code", { p_profile_id: created.user.id });
  refresh();
  if (codeError) return { message: "Hisob yaratildi, lekin kod berilmadi.", login };
  return { message: "Hisob yaratildi", code: code as string, login, name: `${p.first_name} ${p.last_name}` };
}

export async function issueCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const db = await getServerClient();
  const { data, error } = await db.rpc("issue_activation_code", { p_profile_id: String(formData.get("profile_id")) });
  if (error) return { error: errorMessage(error) };
  return { message: "Yangi kod (14 kun amal qiladi). Eski kod bekor qilindi.", code: data as string };
}

export async function rotateCard(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const db = await getServerClient();
  const { error } = await db.rpc("rotate_profile_code", { p_profile_id: String(formData.get("profile_id")) });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { message: "Karta kodi almashtirildi. Yangi kartani chop eting." };
}

export async function setActive(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const db = await getServerClient();
  const { error, count } = await db
    .from("profiles")
    .update({ is_active: formData.get("active") === "1" }, { count: "exact" })
    .eq("id", String(formData.get("profile_id")));
  if (error) return { error: errorMessage(error) };
  if (!count) return NO_ACCESS;
  refresh();
  return {};
}

export async function updateName(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const parsed = personSchema.pick({ first_name: true, last_name: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await getServerClient();
  const { error } = await db.from("profiles").update(parsed.data).eq("id", String(formData.get("profile_id")));
  if (error) return { error: errorMessage(error) };
  refresh();
  return { message: "Saqlandi" };
}

export async function changeClass(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const db = await getServerClient();
  const year = await currentYear(db);
  if (!year) return { error: "Joriy o'quv yili belgilanmagan." };
  const studentId = String(formData.get("profile_id"));
  const classId = String(formData.get("class_id") ?? "");
  const { error } = classId
    ? await db
        .from("enrollments")
        .upsert(
          { school_id: user.schoolId, student_id: studentId, class_id: classId, academic_year_id: year.id },
          { onConflict: "student_id,academic_year_id" },
        )
    : await db.from("enrollments").delete().eq("student_id", studentId).eq("academic_year_id", year.id);
  if (error) return { error: errorMessage(error) };
  refresh();
  return { message: "Sinf saqlandi" };
}

// ---------------------------------------------------------------------------
// Sinflar
// ---------------------------------------------------------------------------

function defaultYear(now = new Date()) {
  // O'quv yili 1-sentabrdan 30-iyungacha (yozda keyingi yil tayyorlanadi).
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { label: `${y}-${y + 1}`, starts_on: `${y}-09-01`, ends_on: `${y + 1}-06-30` };
}

export async function createClass(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const name = String(formData.get("name") ?? "").trim();
  const gradeRaw = String(formData.get("grade") ?? "").trim();
  const grade = gradeRaw ? Number(gradeRaw) : null;
  if (!name) return { error: "Sinf nomini kiriting (masalan: 7-A)" };
  if (grade !== null && !(grade >= 1 && grade <= 12)) return { error: "Sinf darajasi 1–12" };

  const db = await getServerClient();
  let year = await currentYear(db);
  if (!year) {
    const { data, error } = await db
      .from("academic_years")
      .insert({ school_id: user.schoolId, ...defaultYear(), is_current: true })
      .select("id, label")
      .single();
    if (error) return { error: errorMessage(error) };
    year = data;
  }
  const { error } = await db.from("classes").insert({
    school_id: user.schoolId,
    academic_year_id: year!.id,
    name,
    grade,
    homeroom_profile_id: String(formData.get("homeroom") ?? "") || null,
  });
  if (error) return { error: error.code === "23505" ? "Bunday sinf allaqachon bor." : errorMessage(error) };
  refresh();
  return { message: `${name} sinfi qo'shildi` };
}

export async function setHomeroom(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return NO_ACCESS;
  const db = await getServerClient();
  const { error } = await db
    .from("classes")
    .update({ homeroom_profile_id: String(formData.get("homeroom") ?? "") || null })
    .eq("id", String(formData.get("class_id")));
  if (error) return { error: errorMessage(error) };
  refresh();
  return { message: "Saqlandi" };
}

// ---------------------------------------------------------------------------
// Rollar (faqat admin)
// ---------------------------------------------------------------------------

const ROLES: Role[] = ["librarian", "admin", "class_teacher", "quiz_editor"];

export async function saveRoles(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NO_ACCESS;
  const profileId = String(formData.get("profile_id"));
  const wanted = ROLES.filter((r) => formData.get(`role_${r}`) === "on");
  const canCirculate = formData.get("can_circulate") === "on";
  if (profileId === user.id && !wanted.includes("admin")) {
    return { error: "O'zingizdan admin rolini olib bo'lmaydi." };
  }

  const db = await getServerClient();
  const { error: delError } = await db
    .from("memberships")
    .delete()
    .eq("profile_id", profileId)
    .not("role", "in", `(${wanted.length ? wanted.join(",") : "none"})`);
  if (delError) return { error: errorMessage(delError) };
  if (wanted.length) {
    const { error } = await db.from("memberships").upsert(
      wanted.map((role) => ({
        school_id: user.schoolId,
        profile_id: profileId,
        role,
        can_circulate: role === "class_teacher" ? canCirculate : false,
      })),
      { onConflict: "profile_id,role" },
    );
    if (error) return { error: errorMessage(error) };
  }
  refresh();
  return { message: "Rollar saqlandi" };
}
