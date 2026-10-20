"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

export async function logoutAction() {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
