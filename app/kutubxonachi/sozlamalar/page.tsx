import type { Metadata } from "next";
import { Award, BookCopy, ListChecks, School, Trash2, Trophy } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Card, CardHeader, Field, Input, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireStaffArea } from "@/lib/auth";
import { num } from "@/lib/format";
import { getServerClient } from "@/lib/supabase/server";
import { deleteMilestone, saveMilestone, saveSchool, saveSettings } from "./actions";

export const metadata: Metadata = { title: "Sozlamalar" };

type Settings = Record<string, number>;

const GROUPS: { title: string; icon: typeof BookCopy; fields: { key: string; label: string; unit: string }[] }[] = [
  {
    title: "Kitob berish",
    icon: BookCopy,
    fields: [
      { key: "loan_days", label: "Qarz muddati", unit: "kun" },
      { key: "min_hold_days", label: "Hisoblanish uchun minimal o'qish", unit: "kun" },
      { key: "min_pages", label: "Hisoblanadigan kitob hajmi", unit: "bet" },
      { key: "overdue_notice_every_days", label: "Kechikish eslatmasi har", unit: "kun" },
    ],
  },
  {
    title: "Test",
    icon: ListChecks,
    fields: [
      { key: "quiz_questions_per_attempt", label: "Savollar soni", unit: "ta" },
      { key: "quiz_seconds_per_question", label: "Har bir savolga", unit: "soniya" },
      { key: "quiz_start_window_minutes", label: "Qaytargandan keyin boshlash oynasi", unit: "daqiqa" },
      { key: "quiz_max_exits", label: "Ilovadan chiqishga ruxsat", unit: "marta" },
      { key: "quiz_network_grace_seconds", label: "Tarmoq kechikishi zaxirasi", unit: "soniya" },
    ],
  },
  {
    title: "Ball",
    icon: Trophy,
    fields: [
      { key: "base_points_per_book", label: "Kitob uchun bazaviy ball", unit: "ball" },
      { key: "quiz_points_max", label: "Test uchun maksimal ball", unit: "ball" },
      { key: "class_points_cap", label: "Sinf reytingida bir o'quvchi bali chegarasi", unit: "ball" },
    ],
  },
];

export default async function SettingsPage() {
  const user = await requireStaffArea();
  const db = await getServerClient();
  const [{ data: settings }, { data: school }, { data: milestones }] = await Promise.all([
    db.from("school_settings").select("*").maybeSingle<Settings>(),
    db.from("schools").select("name, code, currency_name").maybeSingle(),
    db.from("milestones").select("books, min_avg_bp, reward_total").order("books"),
  ]);
  const readOnly = !user.isAdmin;

  return (
    <>
      <PageHeader title="Sozlamalar" description="Kutubxona qoidalari, ball tizimi va marralar." />
      {readOnly && (
        <Alert tone="brand" className="mb-6">
          Sozlamalarni faqat administrator o&apos;zgartira oladi. Siz ko&apos;rish rejimidasiz.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader icon={BookCopy} title="Qoidalar" />
          <ActionForm action={saveSettings} className="space-y-8 p-5">
            {GROUPS.map((g) => (
              <fieldset key={g.title} disabled={readOnly}>
                <legend className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
                  <g.icon className="size-4" /> {g.title}
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {g.fields.map((f) => (
                    <Field key={f.key} label={f.label}>
                      <div className="relative">
                        <Input name={f.key} type="number" defaultValue={settings?.[f.key]} required className="pr-20" />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">{f.unit}</span>
                      </div>
                    </Field>
                  ))}
                </div>
              </fieldset>
            ))}
            {!readOnly && <SubmitButton pendingText="Saqlanmoqda…">Sozlamalarni saqlash</SubmitButton>}
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={School} title="Maktab" description={`Kod: ${school?.code ?? ""} (kirishda ishlatiladi)`} />
            <ActionForm action={saveSchool} className="space-y-4 p-5">
              <fieldset disabled={readOnly} className="space-y-4">
                <Field label="Maktab nomi">
                  <Input name="name" defaultValue={school?.name} required />
                </Field>
                <Field label="Valyuta nomi" hint="Rag'bat uchun ichki ball (pul emas)">
                  <Input name="currency_name" defaultValue={school?.currency_name} required maxLength={32} />
                </Field>
              </fieldset>
              {!readOnly && <SubmitButton variant="secondary">Saqlash</SubmitButton>}
            </ActionForm>
          </Card>

          <Card>
            <CardHeader
              icon={Award}
              title="Marralar"
              description={`Kitoblar soniga va o'rtacha test natijasiga yetganda beriladigan JAMI ${school?.currency_name ?? "Alfa"}.`}
            />
            <Table>
              <thead>
                <tr>
                  <Th>Kitob</Th>
                  <Th>Min. natija</Th>
                  <Th className="text-right">Jami</Th>
                  {!readOnly && <Th />}
                </tr>
              </thead>
              <tbody>
                {(milestones ?? []).map((m) => (
                  <tr key={m.books}>
                    <Td className="font-semibold">{m.books}</Td>
                    <Td>{Math.round(m.min_avg_bp / 100)}%</Td>
                    <Td className="text-right font-semibold text-gold-700">{num(m.reward_total)}</Td>
                    {!readOnly && (
                      <Td className="w-10 px-2">
                        <ActionForm action={deleteMilestone} inlineStatus>
                          <input type="hidden" name="books" value={m.books} />
                          <button type="submit" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-bad-50 hover:text-bad-600" aria-label="O'chirish">
                            <Trash2 className="size-4" />
                          </button>
                        </ActionForm>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
            {!readOnly && (
              <ActionForm action={saveMilestone} className="grid grid-cols-3 items-end gap-2 p-5" resetOnSuccess>
                <Field label="Kitob">
                  <Input name="books" type="number" min={1} required />
                </Field>
                <Field label="Min. %">
                  <Input name="min_avg" type="number" min={0} max={100} defaultValue={80} required />
                </Field>
                <Field label="Jami">
                  <Input name="reward_total" type="number" min={0} required />
                </Field>
                <SubmitButton variant="secondary" className="col-span-3">
                  Marra qo&apos;shish / yangilash
                </SubmitButton>
              </ActionForm>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
