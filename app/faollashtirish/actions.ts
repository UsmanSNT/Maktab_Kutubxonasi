"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authEmail } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerClient } from "@/lib/supabase/server";

export type ActivateState = { error?: string; school?: string; login?: string };

const schema = z
  .object({
    school: z.string().trim().min(1, "Maktab kodini kiriting"),
    login: z.string().trim().min(1, "ID raqamingizni kiriting"),
    code: z.string().trim().min(6, "Faollashtirish kodini kiriting"),
    password: z.string().min(6, "Parol kamida 6 belgidan iborat bo'lsin"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Parollar bir xil emas", path: ["confirm"] });

// Kod faqat serverda (service_role) tekshiriladi; to'g'ri bo'lsa yangi parol o'rnatiladi va foydalanuvchi kiritiladi.
export async function activateAction(_prev: ActivateState, formData: FormData): Promise<ActivateState> {
  const echo = { school: String(formData.get("school") ?? ""), login: String(formData.get("login") ?? "") };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...echo, error: parsed.error.issues[0].message };
  }
  const school = parsed.data.school.toLowerCase();
  const login = parsed.data.login.toLowerCase();

  const admin = getAdminClient();
  const { data: profileId, error } = await admin.rpc("redeem_activation_code", {
    p_school_code: school,
    p_login_id: login,
    p_code: parsed.data.code.replace(/[\s-]/g, ""),
  });
  if (error || !profileId) {
    return { ...echo, error: "Ma'lumotlar yoki kod noto'g'ri, yoxud kod muddati tugagan. Kutubxonachidan yangi kod so'rang." };
  }

  const { error: pwError } = await admin.auth.admin.updateUserById(profileId as string, {
    password: parsed.data.password,
  });
  if (pwError) {
    return { ...echo, error: "Parolni saqlab bo'lmadi. Kutubxonachidan yangi kod so'rang." };
  }

  const supabase = await getServerClient();
  const { data } = await supabase.auth.signInWithPassword({
    email: authEmail(school, login),
    password: parsed.data.password,
  });
  if (!data.user) redirect("/login");

  const { data: roles } = await supabase.from("memberships").select("role").eq("profile_id", data.user.id).limit(1);
  redirect(roles && roles.length > 0 ? "/kutubxonachi" : "/o-quvchi");
}
