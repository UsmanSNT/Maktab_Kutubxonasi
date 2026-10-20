"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Textarea, cn, inputClass } from "@/components/ui";
import { createQuestion } from "../actions";

export function QuestionForm({ bookId }: { bookId: string }) {
  const [state, action] = useActionState(createQuestion, {});
  const [keys, setKeys] = useState([0, 1, 2, 3]);
  const [correct, setCorrect] = useState(0);
  const next = useRef(4);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message && !state.error) {
      form.current?.reset();
    }
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-4 p-5">
      <input type="hidden" name="book_id" value={bookId} />
      <input type="hidden" name="correct" value={correct} />
      <Field label="Savol">
        <Textarea name="body" required minLength={3} maxLength={1000} placeholder="Masalan: Asar bosh qahramonining ismi nima?" />
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">Javob variantlari</p>
        <p className="text-xs text-muted">To&apos;g&apos;ri javob yonidagi doirachani belgilang.</p>
        {keys.map((k, i) => (
          <div key={k} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrect(i)}
              aria-label="To'g'ri javob"
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                correct === i ? "border-ok-600 bg-ok-600" : "border-line bg-white hover:border-ok-600",
              )}
            >
              {correct === i && <span className="size-2 rounded-full bg-white" />}
            </button>
            <input
              name="option"
              required={i < 2}
              maxLength={500}
              placeholder={`${String.fromCharCode(65 + i)} variant`}
              className={cn(inputClass, "h-10", correct === i && "border-ok-600/50 bg-ok-50/40")}
            />
            {keys.length > 2 && (
              <button
                type="button"
                onClick={() => {
                  setKeys(keys.filter((x) => x !== k));
                  if (correct >= i && correct > 0) setCorrect(correct - 1);
                }}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-bad-50 hover:text-bad-600"
                aria-label="O'chirish"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
        {keys.length < 6 && (
          <button
            type="button"
            onClick={() => setKeys([...keys, next.current++])}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
          >
            <Plus className="size-4" /> Variant qo&apos;shish
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="approve" defaultChecked className="size-4 accent-brand-700" />
        Darhol tasdiqlash (testda ishlatiladi)
      </label>

      {state.error && <p className="text-sm font-medium text-bad-600">{state.error}</p>}
      {state.message && !state.error && <p className="text-sm font-medium text-ok-600">{state.message}</p>}

      <SubmitButton className="w-full" pendingText="Saqlanmoqda…">
        <Plus className="size-4" /> Savol qo&apos;shish
      </SubmitButton>
    </form>
  );
}
