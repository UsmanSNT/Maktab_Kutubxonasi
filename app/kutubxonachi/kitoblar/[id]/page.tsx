import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, BookCopy, Check, CircleCheck, ListChecks, Plus, Printer, RotateCcw, SquarePen, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, CardHeader, EmptyState, Field, Input, LinkButton, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { requireStaffArea } from "@/lib/auth";
import { fmtDate, fullName } from "@/lib/format";
import { peopleById } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";
import { addCopies, deleteQuestion, setCopyCondition, setQuestionStatus, updateBook } from "../actions";
import { QuestionForm } from "./QuestionForm";

export const metadata: Metadata = { title: "Kitob" };

type Copy = { id: string; copy_no: number; condition: "active" | "lost" | "withdrawn" };
type Question = { id: string; body: string; status: "draft" | "approved" | "retired"; created_at: string };

const CONDITION = {
  active: { label: "Faol", tone: "ok" },
  lost: { label: "Yo'qolgan", tone: "bad" },
  withdrawn: { label: "Chiqarilgan", tone: "neutral" },
} as const;

const Q_STATUS = {
  approved: { label: "Tasdiqlangan", tone: "ok" },
  draft: { label: "Qoralama", tone: "warn" },
  retired: { label: "Arxiv", tone: "neutral" },
} as const;

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaffArea();
  const db = await getServerClient();

  const { data: book } = await db.from("books").select("id, title, author, isbn, pages, language").eq("id", id).maybeSingle();
  if (!book) notFound();

  const [{ data: copyData }, { data: loanData }, { data: qData }, { data: settings }] = await Promise.all([
    db.from("book_copies").select("id, copy_no, condition").eq("book_id", id).order("copy_no"),
    db.from("loans").select("copy_id, borrower_id, due_at, status").eq("book_id", id).in("status", ["active", "return_pending"]),
    user.isQuizEditor
      ? db.from("quiz_questions").select("id, body, status, created_at").eq("book_id", id).order("created_at")
      : Promise.resolve({ data: [] as Question[] }),
    db.from("school_settings").select("quiz_questions_per_attempt").maybeSingle(),
  ]);
  const copies = (copyData ?? []) as Copy[];
  const loans = new Map((loanData ?? []).map((l) => [l.copy_id as string, l]));
  const people = await peopleById(db, [...loans.values()].map((l) => l.borrower_id as string));
  const questions = (qData ?? []) as Question[];
  const needed = settings?.quiz_questions_per_attempt ?? 10;

  const qIds = questions.map((q) => q.id);
  const [{ data: optData }, { data: keyData }] = qIds.length
    ? await Promise.all([
        db.from("quiz_options").select("id, question_id, body").in("question_id", qIds),
        db.from("quiz_answer_keys").select("question_id, correct_option_id").in("question_id", qIds),
      ])
    : [{ data: [] }, { data: [] }];
  const keys = new Map((keyData ?? []).map((k) => [k.question_id as string, k.correct_option_id as string]));
  const options = new Map<string, { id: string; body: string }[]>();
  for (const o of optData ?? []) {
    const list = options.get(o.question_id) ?? [];
    list.push({ id: o.id, body: o.body });
    options.set(o.question_id, list);
  }
  const approved = questions.filter((q) => q.status === "approved").length;

  return (
    <>
      <PageHeader
        back={{ href: "/kutubxonachi/kitoblar", label: "Kitoblar" }}
        title={book.title}
        description={`${book.author || "Muallif ko'rsatilmagan"} · ${book.pages} bet${book.isbn ? ` · ISBN ${book.isbn}` : ""}`}
        action={
          user.isStaff &&
          copies.length > 0 && (
            <LinkButton href={`/kutubxonachi/kitoblar/${id}/yorliqlar`} variant="secondary">
              <Printer className="size-4" /> Yorliqlarni chop etish
            </LinkButton>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader icon={BookCopy} title="Nusxalar" description={`${copies.length} ta nusxa`} />
          {copies.length === 0 ? (
            <EmptyState icon={BookCopy} title="Nusxa yo'q" description="O'ng tomondan nusxa qo'shing." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>№</Th>
                  <Th>Holat</Th>
                  <Th>Kimda</Th>
                  {user.isStaff && <Th className="text-right">Amal</Th>}
                </tr>
              </thead>
              <tbody>
                {copies.map((c) => {
                  const loan = loans.get(c.id);
                  return (
                    <tr key={c.id}>
                      <Td className="font-semibold">№{c.copy_no}</Td>
                      <Td>
                        <Badge tone={CONDITION[c.condition].tone}>{CONDITION[c.condition].label}</Badge>
                      </Td>
                      <Td>
                        {loan ? (
                          <span>
                            {fullName(people.get(loan.borrower_id))}
                            <span className="block text-xs text-muted">{fmtDate(loan.due_at)} gacha</span>
                          </span>
                        ) : (
                          <span className="text-muted">Javonda</span>
                        )}
                      </Td>
                      {user.isStaff && (
                        <Td className="text-right">
                          <ActionForm action={setCopyCondition} className="inline-flex gap-1" inlineStatus>
                            <input type="hidden" name="copy_id" value={c.id} />
                            {c.condition === "active" ? (
                              <>
                                <SubmitButton name="condition" value="lost" variant="ghost" size="sm" disabled={!!loan}>
                                  Yo&apos;qoldi
                                </SubmitButton>
                                <SubmitButton name="condition" value="withdrawn" variant="ghost" size="sm" disabled={!!loan}>
                                  Chiqarish
                                </SubmitButton>
                              </>
                            ) : (
                              <SubmitButton name="condition" value="active" variant="ghost" size="sm">
                                <RotateCcw className="size-3.5" /> Tiklash
                              </SubmitButton>
                            )}
                          </ActionForm>
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        {user.isStaff && (
          <div className="space-y-6">
            <Card>
              <CardHeader icon={Plus} title="Nusxa qo'shish" />
              <ActionForm action={addCopies} className="flex flex-wrap items-end gap-3 p-5" resetOnSuccess>
                <input type="hidden" name="book_id" value={id} />
                <div className="flex-1">
                  <Field label="Soni">
                    <Input name="count" type="number" min={1} max={100} defaultValue={1} required />
                  </Field>
                </div>
                <SubmitButton>Qo&apos;shish</SubmitButton>
              </ActionForm>
            </Card>

            <Card>
              <CardHeader icon={SquarePen} title="Ma'lumotlarni tahrirlash" />
              <ActionForm action={updateBook} className="space-y-4 p-5">
                <input type="hidden" name="book_id" value={id} />
                <Field label="Nomi">
                  <Input name="title" defaultValue={book.title} required />
                </Field>
                <Field label="Muallif">
                  <Input name="author" defaultValue={book.author} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Bet">
                    <Input name="pages" type="number" min={1} defaultValue={book.pages} required />
                  </Field>
                  <Field label="Til">
                    <Select name="language" defaultValue={book.language}>
                      <option value="uz">uz</option>
                      <option value="ru">ru</option>
                      <option value="en">en</option>
                      <option value="kk">kk</option>
                      <option value="tg">tg</option>
                      <option value="other">—</option>
                    </Select>
                  </Field>
                  <Field label="ISBN">
                    <Input name="isbn" defaultValue={book.isbn ?? ""} />
                  </Field>
                </div>
                <SubmitButton variant="secondary" className="w-full">
                  Saqlash
                </SubmitButton>
              </ActionForm>
            </Card>
          </div>
        )}
      </div>

      {user.isQuizEditor && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader
              icon={ListChecks}
              title="Test savollari"
              description={
                approved >= needed
                  ? `${approved} ta tasdiqlangan savol — test ishlaydi.`
                  : `Test ochilishi uchun kamida ${needed} ta tasdiqlangan savol kerak (hozir ${approved}).`
              }
              action={<Badge tone={approved >= needed ? "ok" : "warn"}>{approved}/{needed}</Badge>}
            />
            {questions.length === 0 ? (
              <EmptyState icon={ListChecks} title="Savollar yo'q" description="Kitob mazmuni bo'yicha savollar qo'shing." />
            ) : (
              <ol className="divide-y divide-line/60">
                {questions.map((q, i) => (
                  <li key={q.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-ink">
                        <span className="text-muted">{i + 1}.</span> {q.body}
                      </p>
                      <Badge tone={Q_STATUS[q.status].tone}>{Q_STATUS[q.status].label}</Badge>
                    </div>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {(options.get(q.id) ?? []).map((o) => {
                        const isKey = keys.get(q.id) === o.id;
                        return (
                          <li
                            key={o.id}
                            className={
                              isKey
                                ? "flex items-center gap-2 rounded-lg bg-ok-50 px-3 py-1.5 text-sm font-medium text-ok-700"
                                : "rounded-lg bg-paper px-3 py-1.5 text-sm text-muted"
                            }
                          >
                            {isKey && <CircleCheck className="size-4" />} {o.body}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <ActionForm action={setQuestionStatus} className="flex flex-wrap gap-1" inlineStatus>
                        <input type="hidden" name="question_id" value={q.id} />
                        {q.status === "approved" ? (
                          <>
                            <SubmitButton name="status" value="draft" variant="ghost" size="sm">
                              <SquarePen className="size-3.5" /> Qoralamaga
                            </SubmitButton>
                            <SubmitButton name="status" value="retired" variant="ghost" size="sm">
                              <Archive className="size-3.5" /> Arxivlash
                            </SubmitButton>
                          </>
                        ) : (
                          <SubmitButton name="status" value="approved" variant="ghost" size="sm">
                            <Check className="size-3.5" /> Tasdiqlash
                          </SubmitButton>
                        )}
                      </ActionForm>
                      {q.status === "draft" && (
                        <ActionForm action={deleteQuestion} inlineStatus>
                          <input type="hidden" name="question_id" value={q.id} />
                          <SubmitButton variant="ghost" size="sm" className="text-bad-600 hover:bg-bad-50">
                            <Trash2 className="size-3.5" /> O&apos;chirish
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card className="h-fit">
            <CardHeader icon={Plus} title="Yangi savol" />
            <QuestionForm bookId={id} />
          </Card>
        </div>
      )}
    </>
  );
}
