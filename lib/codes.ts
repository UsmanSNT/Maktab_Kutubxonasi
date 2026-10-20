// QR ichidagi matn: "K:<kod>" — kitob nusxasi, "P:<kod>" — foydalanuvchi kartasi.
// Prefikssiz kod ham qabul qilinadi (qo'lda kiritilganda yoki USB skanerdan).
export type ScannedCode = { kind: "copy" | "profile" | "unknown"; code: string };

export const copyQrText = (code: string) => `K:${code}`;
export const profileQrText = (code: string) => `P:${code}`;

export function parseScanned(raw: string): ScannedCode {
  const text = raw.trim();
  const m = /^([KP]):(.+)$/i.exec(text);
  if (!m) return { kind: "unknown", code: text };
  return { kind: m[1].toUpperCase() === "K" ? "copy" : "profile", code: m[2].trim() };
}
