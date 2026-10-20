import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

export type Role = "librarian" | "admin" | "class_teacher" | "quiz_editor";

export type CurrentUser = {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  currency: string;
  kind: "student" | "teacher" | "staff";
  loginId: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  isLibrarian: boolean;
  isAdmin: boolean;
  /** kutubxonachi yoki admin */
  isStaff: boolean;
  isQuizEditor: boolean;
  isClassTeacher: boolean;
  /** berish/qabul qilishga haqli: kutubxonachi yoki ruxsatli sinf rahbari */
  isCirculator: boolean;
  /** xodimlar paneliga kira oladi */
  hasStaffArea: boolean;
};

// Bazada foydalanuvchi email'i "<maktab_kodi>.<login_id>@users.maktab.local" ko'rinishida saqlanadi.
export function authEmail(schoolCode: string, loginId: string): string {
  return `${schoolCode.trim().toLowerCase()}.${loginId.trim().toLowerCase()}@users.maktab.local`;
}

type ProfileRow = {
  id: string;
  school_id: string;
  kind: CurrentUser["kind"];
  login_id: string;
  first_name: string;
  last_name: string;
  schools: { name: string; code: string; currency_name: string } | null;
};

// Bir so'rov ichida bir marta o'qiladi (React cache).
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, school_id, kind, login_id, first_name, last_name, schools(name, code, currency_name)")
      .eq("id", user.id)
      .eq("is_active", true)
      .maybeSingle<ProfileRow>(),
    supabase.from("memberships").select("role, can_circulate").eq("profile_id", user.id),
  ]);
  if (!profile) return null;

  const roles = (memberships ?? []).map((m) => m.role as Role);
  const has = (r: Role) => roles.includes(r);
  const canCirculate = (memberships ?? []).some((m) => m.role === "class_teacher" && m.can_circulate);

  return {
    id: profile.id,
    schoolId: profile.school_id,
    schoolName: profile.schools?.name ?? "",
    schoolCode: profile.schools?.code ?? "",
    currency: profile.schools?.currency_name ?? "Alfa",
    kind: profile.kind,
    loginId: profile.login_id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    roles,
    isLibrarian: has("librarian"),
    isAdmin: has("admin"),
    isStaff: has("librarian") || has("admin"),
    isQuizEditor: has("librarian") || has("admin") || has("quiz_editor"),
    isClassTeacher: has("class_teacher"),
    isCirculator: has("librarian") || canCirculate,
    hasStaffArea: roles.length > 0,
  };
});

export function roleLabel(user: CurrentUser): string {
  if (user.isAdmin) return "Administrator";
  if (user.isLibrarian) return "Kutubxonachi";
  if (user.isClassTeacher) return "Sinf rahbari";
  if (user.isQuizEditor) return "Test muharriri";
  return user.kind === "student" ? "O'quvchi" : "O'qituvchi";
}

export function shellUser(user: CurrentUser) {
  return {
    name: `${user.firstName} ${user.lastName}`,
    initials: `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase(),
    schoolName: user.schoolName,
    roleLabel: roleLabel(user),
    isCirculator: user.isCirculator,
  };
}

export function homeFor(user: CurrentUser): string {
  return user.hasStaffArea ? "/kutubxonachi" : "/o-quvchi";
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireStaffArea(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.hasStaffArea) redirect("/o-quvchi");
  return user;
}

/** Sahifa ichidagi qo'shimcha tekshiruv: ruxsat bo'lmasa bosh panelga qaytaradi. */
export async function requireStaffWith(check: (u: CurrentUser) => boolean): Promise<CurrentUser> {
  const user = await requireStaffArea();
  if (!check(user)) redirect("/kutubxonachi");
  return user;
}
