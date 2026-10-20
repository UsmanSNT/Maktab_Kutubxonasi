import type { Metadata } from "next";
import { Library } from "lucide-react";
import { PrintButton } from "@/components/PrintButton";
import { QrCode } from "@/components/QrCode";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireStaffWith } from "@/lib/auth";
import { profileQrText } from "@/lib/codes";
import { classOfStudents, currentClasses } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kartalar" };

type Person = { id: string; first_name: string; last_name: string; login_id: string };

// O'quvchi kutubxona kartalari: bank kartasi o'lchamiga yaqin, A4 da 2 ustun.
export default async function CardsPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const user = await requireStaffWith((u) => u.isStaff);
  const { class: classId } = await searchParams;
  const db = await getServerClient();

  const classes = await currentClasses(db);
  const selected = classes.find((c) => c.id === classId);
  const { data } = await db
    .from("profiles")
    .select("id, first_name, last_name, login_id")
    .eq("kind", "student")
    .eq("is_active", true)
    .order("last_name")
    .limit(2000);
  let people = (data ?? []) as Person[];
  const classOf = await classOfStudents(db, people.map((p) => p.id));
  if (selected) people = people.filter((p) => classOf.get(p.id)?.id === selected.id);

  const ids = people.map((p) => p.id);
  const { data: codes } = ids.length ? await db.from("profile_codes").select("profile_id, public_code").in("profile_id", ids) : { data: [] };
  const codeOf = new Map((codes ?? []).map((c) => [c.profile_id as string, c.public_code as string]));

  return (
    <>
      <div className="no-print">
        <PageHeader
          back={{ href: "/kutubxonachi/oquvchilar", label: "O'quvchilar" }}
          title={`Kutubxona kartalari${selected ? ` · ${selected.name}` : ""}`}
          description={`${people.length} ta karta. Sinf bo'yicha chop etish uchun o'quvchilar ro'yxatida sinfni tanlang.`}
          action={people.length > 0 && <PrintButton />}
        />
      </div>

      {people.length === 0 ? (
        <EmptyState icon={Library} title="Karta yo'q" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
          {people.map((p) => {
            const code = codeOf.get(p.id);
            if (!code) return null;
            return (
              <div
                key={p.id}
                className="flex aspect-[1.586] break-inside-avoid overflow-hidden rounded-2xl border border-line bg-white shadow-card print:shadow-none"
              >
                <div className="flex flex-1 flex-col justify-between bg-brand-900 p-4 text-white">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg bg-gold-500 text-brand-900">
                      <Library className="size-4" strokeWidth={2.5} />
                    </span>
                    <span className="text-xs font-semibold leading-tight text-brand-100">{user.schoolName}</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gold-400">Kutubxona kartasi</p>
                    <p className="mt-1 text-lg font-bold leading-tight">
                      {p.last_name}
                      <br />
                      {p.first_name}
                    </p>
                    <p className="mt-1 text-xs text-brand-200">
                      {classOf.get(p.id)?.name ?? ""} · ID {p.login_id}
                    </p>
                  </div>
                </div>
                <div className="grid w-[42%] place-items-center p-3">
                  <QrCode text={profileQrText(code)} size={120} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
