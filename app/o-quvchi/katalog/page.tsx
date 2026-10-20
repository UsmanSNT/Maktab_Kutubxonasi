import type { Metadata } from "next";
import { Library, Search } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Katalog" };

type CatalogRow = { book_id: string; title: string; author: string; pages: number; total_copies: number; available_copies: number };

const COVERS = [
  "from-brand-600 to-brand-900",
  "from-[#9a3b2e] to-[#5b1d16]",
  "from-[#2f6b4f] to-[#163a2a]",
  "from-[#6d4aa3] to-[#35205a]",
  "from-[#b7791f] to-[#6b430c]",
  "from-[#2b6c8f] to-[#13384d]",
];

function coverOf(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COVERS[h % COVERS.length];
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; free?: string }> }) {
  await requireUser();
  const { q = "", free } = await searchParams;
  const db = await getServerClient();
  const { data } = await db.rpc("catalog_overview");
  const needle = q.trim().toLowerCase();
  let rows = ((data ?? []) as CatalogRow[]).filter((b) => b.total_copies > 0);
  if (needle) rows = rows.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(needle));
  if (free) rows = rows.filter((b) => b.available_copies > 0);

  return (
    <>
      <PageHeader title="Katalog" description="Kutubxonadagi kitoblar va hozir javonda borlari." />
      <form className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Kitob yoki muallif" className={`${inputClass} pl-10`} />
        </div>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink">
          <input type="checkbox" name="free" value="1" defaultChecked={!!free} className="size-4 accent-brand-700" />
          Faqat bo&apos;shlari
        </label>
        <button type="submit" className="h-11 rounded-xl bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800">
          Qidirish
        </button>
      </form>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Library} title="Kitob topilmadi" />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((b) => (
            <Card key={b.book_id} className="flex flex-col overflow-hidden">
              <div className={`relative flex aspect-[3/4] flex-col justify-between bg-gradient-to-br p-4 text-white ${coverOf(b.book_id)}`}>
                <div className="absolute inset-y-0 left-2 w-px bg-white/20" />
                <p className="line-clamp-4 pl-2 text-lg font-bold leading-snug">{b.title}</p>
                <p className="line-clamp-2 pl-2 text-xs text-white/75">{b.author}</p>
              </div>
              <div className="flex flex-1 flex-col justify-between gap-2 p-3">
                <p className="text-xs text-muted">{b.pages} bet</p>
                {b.available_copies > 0 ? (
                  <Badge tone="ok" className="w-fit">
                    Javonda: {b.available_copies}
                  </Badge>
                ) : (
                  <Badge tone="neutral" className="w-fit">
                    Hammasi band
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
