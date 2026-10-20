"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authEmail } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; school?: string; login?: string };

const schema = z.object({
  school: z.string().trim().min(1, "Maktab kodini kiriting"),
  login: z.string().trim().min(1, "ID raqamingizni kiriting"),
  password: z.string().min(1, "Parolni kiriting"),
});

const GENERIC_ERROR = "Maktab kodi, ID yoki parol noto'g'ri";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const echo = { school: String(formData.get("school") ?? ""), login: String(formData.get("login") ?? "") };
  if (!parsed.success) {
    return { ...echo, error: parsed.error.issues[0].message };
  }

  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmail(parsed.data.school, parsed.data.login),
    password: parsed.data.password,
  });
  if (error || !data.user) {
    return { ...echo, error: GENERIC_ERROR };
  }

  // Xodim (biror roli bor) — kutubxonachi paneliga, qolganlar — o'quvchi sahifasiga.
  const { data: roles } = await supabase.from("memberships").select("role").eq("profile_id", data.user.id).limit(1);
  redirect(roles && roles.length > 0 ? "/kutubxonachi" : "/o-quvchi");
}
