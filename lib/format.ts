// Sana va sonlarni o'zbekcha ko'rinishda chiqarish. Vaqt mintaqasi: Toshkent.
const TZ = "Asia/Tashkent";

const dateFmt = new Intl.DateTimeFormat("uz-Latn-UZ", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("uz-Latn-UZ", { timeZone: TZ, day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("uz-Latn-UZ", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function fmtDate(value: string | Date | null | undefined): string {
  return value ? dateFmt.format(new Date(value)) : "—";
}

export function fmtShort(value: string | Date | null | undefined): string {
  return value ? shortFmt.format(new Date(value)) : "—";
}

export function fmtDateTime(value: string | Date | null | undefined): string {
  return value ? timeFmt.format(new Date(value)) : "—";
}

const DAY = 24 * 60 * 60 * 1000;

// Musbat: muddatgacha qolgan kun; manfiy: necha kun kechikkan.
export function daysUntil(value: string, now: number): number {
  return Math.ceil((new Date(value).getTime() - now) / DAY);
}

// Bazis punkt (10000 = 100%) -> foiz.
export function pct(bp: number | null | undefined): string {
  if (bp == null) return "—";
  return `${Math.round(bp / 100)}%`;
}

export function num(n: number | null | undefined): string {
  return new Intl.NumberFormat("uz-Latn-UZ").format(n ?? 0);
}

export function fullName(p: { first_name: string; last_name: string } | null | undefined): string {
  return p ? `${p.last_name} ${p.first_name}` : "—";
}

export function initials(p: { first_name: string; last_name: string }): string {
  return `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase();
}

// Server komponentlari har so'rovda bir marta chiziladi, shuning uchun so'rov vaqtini olish xavfsiz.
export function requestNow(): number {
  return Date.now();
}
