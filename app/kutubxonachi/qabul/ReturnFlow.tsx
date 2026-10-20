"use client";

import { useRef, useState, useTransition } from "react";
import { BookOpen, CircleCheck, Clock, ListChecks, Loader2, TriangleAlert } from "lucide-react";
import { Scanner } from "@/components/Scanner";
import { Alert, Badge, Card, buttonClass } from "@/components/ui";
import { parseScanned } from "@/lib/codes";
import { fmtDate } from "@/lib/format";
import { lookupCopy, recordReturn, type FoundCopy, type ReturnResult } from "../actions";

const REASONS: Record<string, string> = {
  too_few_pages: "kitob sahifalari kam",
  held_too_briefly: "juda qisqa muddat o'qilgan",
  book_already_counted: "bu kitob avval hisoblangan",
};

type Done = { title: string; name: string | null; result: ReturnResult };

export function ReturnFlow({ verifiesImmediately }: { verifiesImmediately: boolean }) {
  const [copy, setCopy] = useState<(FoundCopy & { qr: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Done[]>([]);
  const [pending, start] = useTransition();
  const opId = useRef<string | null>(null);

  const handleScan = (raw: string) => {
    const { code } = parseScanned(raw);
    setError(null);
    start(async () => {
      const res = await lookupCopy(code);
      if (!res.ok) return setError(res.error);
      opId.current = null;
      setCopy({ ...res.data, qr: code });
    });
  };

  const confirm = () => {
    if (!copy) return;
    opId.current ??= crypto.randomUUID();
    const id = opId.current;
    setError(null);
    start(async () => {
      const res = await recordReturn({ opId: id, qr: copy.qr, clientTs: new Date().toISOString() });
      if (!res.ok) return setError(res.error);
      setHistory((h) => [{ title: copy.title, name: copy.borrower_name, result: res.data }, ...h].slice(0, 8));
      setCopy(null);
      opId.current = null;
    });
  };

  const problem = copy
    ? !copy.loan_id
      ? "Bu nusxa hech kimda emas — qaytarish shart emas."
      : copy.loan_status === "return_pending"
        ? "Qaytarish allaqachon qayd etilgan, kutubxonachi tasdig'i kutilmoqda."
        : null
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Card className="p-5">
        <Scanner onScan={handleScan} disabled={pending} label="Qaytarilgan kitob yorlig'ini skaner qiling" />
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          {copy ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-50 text-gold-700">
                  <BookOpen className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{copy.title}</p>
                  <p className="text-sm text-muted">Nusxa №{copy.copy_no}</p>
                </div>
              </div>
              {copy.loan_id && (
                <dl className="grid grid-cols-2 gap-3 rounded-xl bg-paper p-4 text-sm">
                  <div>
                    <dt className="text-muted">Kimda</dt>
                    <dd className="font-semibold text-ink">{copy.borrower_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Muddat</dt>
                    <dd className="font-semibold text-ink">{fmtDate(copy.due_at)}</dd>
                  </div>
                </dl>
              )}
              {problem && (
                <p className="flex items-start gap-1.5 text-sm font-medium text-warn-600">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {problem}
                </p>
              )}
              <button
                type="button"
                onClick={confirm}
                disabled={!!problem || pending}
                className={buttonClass("success", "lg", "w-full")}
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Qabul qilish
              </button>
              {!verifiesImmediately && (
                <p className="text-xs text-muted">
                  Sinf rahbari qabul qilganda qaytarish kutubxonachi tasdig&apos;idan keyin yakunlanadi.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted">
              <BookOpen className="size-5" /> Kitob yorlig&apos;ini skaner qiling — ma&apos;lumot shu yerda chiqadi.
            </div>
          )}
        </Card>

        {error && <Alert>{error}</Alert>}

        {history.length > 0 && (
          <Card>
            <p className="border-b border-line/70 px-5 py-3 text-sm font-semibold text-muted">Shu seansda qabul qilindi</p>
            <ul className="divide-y divide-line/60">
              {history.map((h, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok-600" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-ink">{h.title}</p>
                    <p className="text-muted">{h.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {h.result.status === "return_pending" ? (
                        <Badge tone="warn">
                          <Clock className="size-3" /> Tasdiq kutilmoqda
                        </Badge>
                      ) : h.result.scored ? (
                        <Badge tone="ok">Reytingga hisoblandi</Badge>
                      ) : (
                        h.result.not_scored_reason && (
                          <Badge tone="neutral">Hisoblanmadi: {REASONS[h.result.not_scored_reason] ?? h.result.not_scored_reason}</Badge>
                        )
                      )}
                      {h.result.quiz_offered && (
                        <Badge tone="brand">
                          <ListChecks className="size-3" /> Test ochildi
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
