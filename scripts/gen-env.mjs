// Mahalliy sirlarni yaratadi: .env (parol, JWT kalit, anon/service_role kalitlari).
// Mavjud .env ni o'zgartirmaydi. .env repoga kirmaydi (.gitignore).
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const FILE = ".env";
if (existsSync(FILE)) {
  console.log(`${FILE} allaqachon bor, o'zgartirilmadi.`);
  process.exit(0);
}

const b64url = (input) => Buffer.from(input).toString("base64url");
const nowSec = Math.floor(Date.now() / 1000);

// PostgREST va GoTrue shu JWT sirini tekshiradi; anon/service_role kalitlari ham shu sirdan imzolanadi.
function signJwt(role, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ role, iss: "supabase-local", iat: nowSec, exp: nowSec + 10 * 365 * 24 * 3600 }),
  );
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const postgresPassword = randomBytes(24).toString("hex");
const jwtSecret = randomBytes(40).toString("hex");
const anonKey = signJwt("anon", jwtSecret);
const serviceKey = signJwt("service_role", jwtSecret);

const lines = [
  "# Mahalliy sirlar — repoga qo'shmang",
  `POSTGRES_PASSWORD=${postgresPassword}`,
  "POSTGRES_DB=maktab",
  `JWT_SECRET=${jwtSecret}`,
  "JWT_EXPIRY=3600",
  "API_EXTERNAL_URL=http://127.0.0.1:8000/auth/v1",
  "SITE_URL=http://localhost:3000",
  "DISABLE_SIGNUP=true",
  "ENABLE_EMAIL_SIGNUP=true",
  "ENABLE_EMAIL_AUTOCONFIRM=true",
  "",
  "# Ilova (Next.js serveri) shu manzillardan foydalanadi",
  "SUPABASE_URL=http://127.0.0.1:8000",
  `SUPABASE_ANON_KEY=${anonKey}`,
  `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,
  "",
];
writeFileSync(FILE, lines.join("\n"), { mode: 0o600 });
console.log(`${FILE} yaratildi (ruxsat: faqat egasi).`);
