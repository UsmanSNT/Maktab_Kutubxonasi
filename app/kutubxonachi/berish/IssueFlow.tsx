"use client";

import { useRef, useState, useTransition } from "react";
import { BookOpen, CircleCheck, GraduationCap, Loader2, RotateCcw, TriangleAlert, UserRound } from "lucide-react";
import { Scanner } from "@/components/Scanner";
import { Alert, Avatar, Badge, Card, buttonClass, cn } from "@/components/ui";
import { parseScanned } from "@/lib/codes";
import { fmtDate } from "@/lib/format";
import { issueLoan, lookupCopy, lookupProfile, type FoundCopy, type FoundProfile } from "../actions";

type Done = { title: string; name: string; due_at: string };

// Kitob berish: 1) o'quvchi kartasi, 2) kitob yorlig'i, 3) tasdiqlash.
// Kodlar istalgan tartibda skaner qilinishi mumkin — prefiks (P:/K:) bo'yicha ajratiladi.
export function IssueFlow() {
  const [borrower, setBorrower] = useState<FoundProfile | null>(null);
  const [copy, setCopy] = useState<FoundCopy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  // Bir xil id bilan qayta yuborilsa (tarmoq uzilsa), baza dublikat yaratmaydi.
  const loanId = useRef<string | null>(null);

  const reset = () => {
    setBorrower(null);
    setCopy(null);
    setError(null);
    setDone(null);
    loanId.current = null;
  };

  const handleScan = (raw: string) => {
    const scanned = parseScanned(raw);
    setError(null);
    setDone(null);
    start(async () => {
      const wantProfile = scanned.kind === "profile" || (scanned.kind === "unknown" && !borrower);
      if (wantProfile) {
        const res = await lookupProfile(scanned.code);
        if (res.ok) {
          setBorrower(res.data);
          return;
        }
        if (scanned.kind === "profile") return setError(res.error);
      }
      const res = await lookupCopy(scanned.code);
      if (!res.ok) return setError(res.error);
      setCopy(res.data);
    });
  };

  const copyProblem =
    copy &&
    (copy.condition !== "active"
      ? "Bu nusxa yo'qolgan yoki hisobdan chiqarilgan."
      : copy.loan_id
        ? `Bu nusxa hozir ${copy.borrower_name ?? "boshqa o'quvchi"}da (qaytarish muddati: ${fmtDate(copy.due_at)}).`
        : null);

  const confirm = () => {
    if (!borrower || !copy) return;
    setError(null);
    loanId.current ??= crypto.randomUUID();
    const id = loanId.current;
    start(async () => {
      const res = await issueLoan({
        loanId: id,
        copyId: copy.copy_id,
        borrowerId: borrower.profile_id,
        clientTs: new Date().toISOString(),
      });
      if (!res.ok) return setError(res.error);
      setDone({ title: copy.title, name: `${borrower.first_name} ${borrower.last_name}`, due_at: res.data.due_at });
      setBorrower(null);
      setCopy(null);
      loanId.current = null;
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Card className="p-5">
        <Scanner
          onScan={handleScan}
          disabled={pending}
          label={!borrower ? "O'quvchi kartasini skaner qiling" : "Kitob yorlig'ini skaner qiling"}
        />
        <p className="mt-3 text-xs text-muted">
          Kartani ham, kitobni ham istalgan tartibda skaner qilish mumkin. USB skaner ham ishlaydi.
        </p>
      </Card>

      <div className="space-y-4">
        {done && (
          <Card className="border-ok-600/25 bg-ok-50 p-5">
            <div className="flex items-start gap-3">
              <CircleCheck className="mt-0.5 size-6 shrink-0 text-ok-600" />
              <div>
                <p className="font-semibold text-ok-700">Kitob berildi</p>
                <p className="mt-1 text-sm text-ink">
                  <b>{done.title}</b> — {done.name}. Qaytarish muddati: <b>{fmtDate(done.due_at)}</b>
                </p>
              </div>
            </div>
          </Card>
        )}

        <Step n={1} title="O'quvchi" icon={UserRound} active={!borrower}>
          {borrower ? (
            <div className="flex items-start gap-3">
              <Avatar text={`${borrower.first_name[0]}${borrower.last_name[0]}`} className="size-11 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">
                  {borrower.last_name} {borrower.first_name}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                  <GraduationCap className="size-4" />
                  {borrower.class_name ?? (borrower.kind === "student" ? "Sinf belgilanmagan" : "O'qituvchi")}
                </p>
                {borrower.open_loans.length > 0 && (
                  <div className="mt-3 rounded-xl bg-paper p-3 text-sm">
                    <p className="font-medium text-ink">Qo&apos;lidagi kitoblar: {borrower.open_loans.length}</p>
                    <ul className="mt-1 space-y-0.5 text-muted">
                      {borrower.open_loans.map((l, i) => (
                        <li key={i}>
                          {l.title} · {fmtDate(l.due_at)} gacha
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setBorrower(null)} className="text-sm font-medium text-brand-700 hover:underline">
                O&apos;zgartirish
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">Kartadagi QR kodni skaner qiling.</p>
          )}
        </Step>

        <Step n={2} title="Kitob" icon={BookOpen} active={!!borrower && !copy}>
          {copy ? (
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-50 text-gold-700">
                <BookOpen className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{copy.title}</p>
                <p className="mt-0.5 text-sm text-muted">Nusxa №{copy.copy_no}</p>
                {copyProblem ? (
                  <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-bad-600">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {copyProblem}
                  </p>
                ) : (
                  <Badge tone="ok" className="mt-2">
                    Bo&apos;sh
                  </Badge>
                )}
              </div>
              <button type="button" onClick={() => setCopy(null)} className="text-sm font-medium text-brand-700 hover:underline">
                O&apos;zgartirish
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">Kitob ichidagi yorliqni skaner qiling.</p>
          )}
        </Step>

        {error && <Alert>{error}</Alert>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={confirm}
            disabled={!borrower || !copy || !!copyProblem || pending}
            className={buttonClass("primary", "lg", "flex-1")}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Kitobni berish
          </button>
          <button type="button" onClick={reset} className={buttonClass("secondary", "lg")} aria-label="Boshidan">
            <RotateCcw className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  icon: Icon,
  active,
  children,
}: {
  n: number;
  title: string;
  icon: typeof BookOpen;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("p-5 transition-shadow", active && "ring-2 ring-brand-500/40")}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
        <span className={cn("grid size-6 place-items-center rounded-full text-xs", active ? "bg-brand-700 text-white" : "bg-paper-2")}>
          {n}
        </span>
        <Icon className="size-4" /> {title}
      </div>
      {children}
    </Card>
  );
}
