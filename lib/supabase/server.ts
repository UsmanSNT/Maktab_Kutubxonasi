import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

// Foydalanuvchi sessiyasi bilan (cookie). RPC va RLS shu klient orqali ishlaydi.
export async function getServerClient() {
  const env = getEnv();
  const cookieStore = await cookies();

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component ichidan chaqirilganda cookie yozib bo'lmaydi; middleware yangilaydi.
        }
      },
    },
  });
}
