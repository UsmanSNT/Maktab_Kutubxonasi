import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

// service_role: RLS'ni chetlab o'tadi. Faqat foydalanuvchi yaratish, faollashtirish va cron uchun.
let admin: SupabaseClient | undefined;

export function getAdminClient(): SupabaseClient {
  if (!admin) {
    const env = getEnv();
    admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
