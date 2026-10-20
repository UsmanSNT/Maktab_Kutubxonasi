import type { Metadata } from "next";
import Link from "next/link";
import { BookPlus, ChevronRight, Library, ListChecks, Search } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, inputClass } from "@/components/ui";
import { requireStaffArea } from "@/lib/auth";
import { num } from "@/lib/format";
import { getServerClient } from "@/lib/supabase/server";
import { createBook } from "./actions";

export const metadata: Metadata = { title: "Kitoblar" };

type CatalogRow = {
  book_id: string;
  title: string;
  author: string;
  pages: number;
  total_copies: number;
  available_copies: number;
};

export default async function BooksPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireStaffArea();
  const { q = "" } = await searchParams;
  const db = await getServerClient();

  const [{ data }, { data: questions }, { data: settings }] = await Promise.all([
    db.rpc("catalog_overview"),
    user.isQuizEditor
      ? db.from("quiz_questions").select("book_id").eq("status", "approved")
      : Promise.resolve({ data: [] as { book_id: string }[] }),
    db.from("school_settings").select("quiz_questions_per_attempt").maybeSingle(),
  ]);
  const needed = settings?.quiz_questions_per_attempt ?? 10;
  const qCount = new Map<string, number>();
  for (const r of questions ?? []) qCount.set(r.book_id, (qCount.get(r.book_id) ?? 0) + 1);

  const needle = q.trim().toLowerCase();
  const all = (data ?? []) as CatalogRow[];
  const rows = needle ? all.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(needle)) : all;
  const totalCopies = all.reduce((s, b) => s + b.total_copies, 0);
  const available = all.reduce((s, b) => s + b.available_copies, 0);

  return (
    <>
      <PageHeader
        title="Kitoblar"
        description={`${num(all.length)} nom · ${num(totalCopies)} nusxa · ${num(available)} tasi javonda`}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <div className="border-b border-line/70 p-4">
            <form className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input name="q" defaultValue={q} placeholder="Kitob yoki muallif bo'yicha qidirish" className={`${inputClass} pl-10`} />
            </form>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              icon={Library}
              title={needle ? "Hech narsa topilmadi" : "Katalog bo'sh"}
              description={needle ? "Boshqa so'z bilan qidirib ko'ring." : "O'ng tomondagi forma orqali birinchi kitobni qo'shing."}
            />
          ) : (
            <ul className="divide-y divide-line/60">
              {rows.map((b) => {
                const qc = qCount.get(b.book_id) ?? 0;
                return (
                  <li key={b.book_id}>
                    <Link href={`/kutubxonachi/kitoblar/${b.book_id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-paper/60">
                      <span className="grid h-12 w-9 shrink-0 place-items-center rounded-md bg-gradient-to-br from-brand-600 to-brand-900 text-[10px] font-bold text-gold-400 shadow-sm">
                        {b.title.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{b.title}</p>
                        <p className="truncate text-sm text-muted">
                          {b.author || "Muallif ko'rsatilmagan"} · {b.pages} bet
                        </p>
                      </div>
                      <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                        {user.isQuizEditor && (
                          <Badge tone={qc >= needed ? "ok" : qc > 0 ? "warn" : "neutral"}>
                            <ListChecks className="size-3" /> {qc}/{needed}
                          </Badge>
                        )}
                        <Badge tone={b.available_copies > 0 ? "brand" : "bad"}>
                          {b.available_copies}/{b.total_copies} bo&apos;sh
                        </Badge>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {user.isStaff && (
          <Card className="h-fit xl:sticky xl:top-10">
            <CardHeader icon={BookPlus} title="Yangi kitob" description="Nusxalar uchun QR yorliqlar avtomatik yaratiladi." />
            <ActionForm action={createBook} className="space-y-4 p-5">
              <Field label="Nomi">
                <Input name="title" required maxLength={300} />
              </Field>
              <Field label="Muallif">
                <Input name="author" maxLength={200} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sahifalar">
                  <Input name="pages" type="number" min={1} required />
                </Field>
                <Field label="Nusxalar">
                  <Input name="copies" type="number" min={0} max={100} defaultValue={1} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Til">
                  <Select name="language" defaultValue="uz">
                    <option value="uz">O&apos;zbek</option>
                    <option value="ru">Rus</option>
                    <option value="en">Ingliz</option>
                    <option value="kk">Qoraqalpoq</option>
                    <option value="tg">Tojik</option>
                    <option value="other">Boshqa</option>
                  </Select>
                </Field>
                <Field label="ISBN">
                  <Input name="isbn" maxLength={32} />
                </Field>
              </div>
              <SubmitButton className="w-full" pendingText="Saqlanmoqda…">
                <BookPlus className="size-4" /> Qo&apos;shish
              </SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
