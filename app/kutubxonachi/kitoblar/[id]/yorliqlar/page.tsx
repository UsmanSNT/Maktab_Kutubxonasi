import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { QrCode } from "@/components/QrCode";
import { PageHeader } from "@/components/ui";
import { requireStaffWith } from "@/lib/auth";
import { copyQrText } from "@/lib/codes";
import { getServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Yorliqlar" };

// Kitob nusxalari uchun QR yorliqlar (A4 varaqqa 3 ustun). Faqat faol nusxalar.
export default async function LabelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaffWith((u) => u.isStaff);
  const db = await getServerClient();

  const { data: book } = await db.from("books").select("id, title, author").eq("id", id).maybeSingle();
  if (!book) notFound();
  const { data: copies } = await db.from("book_copies").select("id, copy_no").eq("book_id", id).eq("condition", "active").order("copy_no");
  const ids = (copies ?? []).map((c) => c.id as string);
  const { data: codes } = ids.length ? await db.from("copy_codes").select("copy_id, qr_code").in("copy_id", ids) : { data: [] };
  const codeOf = new Map((codes ?? []).map((c) => [c.copy_id as string, c.qr_code as string]));

  return (
    <>
      <div className="no-print">
        <PageHeader
          back={{ href: `/kutubxonachi/kitoblar/${id}`, label: book.title }}
          title="QR yorliqlar"
          description="Har bir yorliqni kesib, kitobning ichki muqovasiga yopishtiring."
          action={<PrintButton />}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
        {(copies ?? []).map((c) => {
          const code = codeOf.get(c.id);
          if (!code) return null;
          return (
            <div
              key={c.id}
              className="flex break-inside-avoid items-center gap-3 rounded-xl border border-dashed border-line bg-white p-3 print:rounded-none"
            >
              <QrCode text={copyQrText(code)} size={84} className="shrink-0" />
              <div className="min-w-0 text-xs leading-snug">
                <p className="line-clamp-2 font-bold text-ink">{book.title}</p>
                <p className="mt-0.5 truncate text-muted">{book.author}</p>
                <p className="mt-1 font-semibold text-brand-700">Nusxa №{c.copy_no}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted">{user.schoolName}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
