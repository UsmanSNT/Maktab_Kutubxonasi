"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

const schema = z.object({
  school: z.string().trim().min(1, "Maktab kodini kiriting"),
  login: z.string().trim().min(1, "ID raqamingizni kiriting"),
  password: z.string().min(1, "Parolni kiriting"),
});

// Bazada foydalanuvchi email'i "<maktab_kodi>.<login_id>@users.maktab.local" ko'rinishida saqlanadi.
const GENERIC_ERROR = "Maktab kodi, ID yoki parol noto'g'ri";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const school = parsed.data.school.toLowerCase();
  const login = parsed.data.login.toLowerCase();
  const email = `${school}.${login}@users.maktab.local`;

  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) {
    return { error: GENERIC_ERROR };
  }

  redirect("/kutubxonachi");
}
