import type { Metadata } from "next";
import { Library } from "lucide-react";
import { QrCode } from "@/components/QrCode";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { profileQrText } from "@/lib/codes";
import { classOfStudents } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mening kartam" };

export default async function MyCardPage() {
  const user = await requireUser();
  const db = await getServerClient();
  const [{ data: card }, classes] = await Promise.all([
    db.from("profile_codes").select("public_code").eq("profile_id", user.id).maybeSingle(),
    classOfStudents(db, [user.id]),
  ]);

  return (
    <div className="mx-auto max-w-sm">
      <PageHeader title="Mening kartam" description="Kitob olayotganda shu QR kodni kutubxonachiga ko'rsating." />
      <div className="overflow-hidden rounded-3xl bg-white shadow-pop ring-1 ring-line/70">
        <div className="relative overflow-hidden bg-brand-900 p-6 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-gold-500/25 blur-2xl" />
          <div className="relative flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-gold-500 text-brand-900">
              <Library className="size-4" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-semibold text-brand-100">{user.schoolName}</span>
          </div>
          <p className="relative mt-6 text-xs uppercase tracking-widest text-gold-400">Kutubxona kartasi</p>
          <p className="relative mt-1 text-2xl font-bold">
            {user.firstName} {user.lastName}
          </p>
          <p className="relative mt-1 text-sm text-brand-200">
            {classes.get(user.id)?.name ? `${classes.get(user.id)!.name} · ` : ""}ID {user.loginId}
          </p>
        </div>
        <div className="grid place-items-center p-8">
          {card ? <QrCode text={profileQrText(card.public_code)} size={232} /> : <p className="text-muted">Karta topilmadi</p>}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted">Yorug&apos;likni oshiring va ekranni skanerga yaqinroq tuting.</p>
    </div>
  );
}
