import "server-only";
import { z } from "zod";

// Faqat serverda o'qiladi. service_role kaliti brauzerga hech qachon chiqmasligi kerak.
const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Muhit o'zgaruvchilari noto'g'ri yoki yo'q: ${missing}. "npm run env:init" ni ishga tushiring.`);
    }
    cached = parsed.data;
  }
  return cached;
}
