"use client";

import { useState, useTransition } from "react";
import { BookDown, BookUp, CircleCheck } from "lucide-react";
import { Scanner } from "@/components/Scanner";
import { Alert, Card, cn } from "@/components/ui";
import { parseScanned } from "@/lib/codes";
import { createRequest } from "../actions";

// O'quvchi kitob yorlig'ini o'z telefonida skaner qiladi -> kutubxonachiga so'rov ketadi.
export function RequestScanner() {
  const [kind, setKind] = useState<"borrow" | "return">("borrow");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onScan = (raw: string) => {
    const { kind: k, code } = parseScanned(raw);
    if (k === "profile") {
      setError("Bu kutubxona kartasi. Kitob ichidagi yorliqni skaner qiling.");
      return;
    }
    setError(null);
    setSent(null);
    start(async () => {
      const res = await createRequest(kind, code);
      if (!res.ok) return setError(res.error);
      setSent(res.data.title);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-paper-2/70 p-1.5">
        {(
          [
            { k: "borrow", label: "Kitob olish", icon: BookUp },
            { k: "return", label: "Qaytarish", icon: BookDown },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => {
              setKind(t.k);
              setSent(null);
              setError(null);
            }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors",
              kind === t.k ? "bg-white text-ink shadow-sm" : "text-muted",
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <Scanner onScan={onScan} disabled={pending} label="Kitob yorlig'ini skaner qiling" placeholder="Yorliq kodi" />
      </Card>

      {error && <Alert>{error}</Alert>}
      {sent && (
        <Card className="flex items-start gap-3 border-ok-600/25 bg-ok-50 p-4">
          <CircleCheck className="mt-0.5 size-6 shrink-0 text-ok-600" />
          <div>
            <p className="font-semibold text-ok-700">So&apos;rov yuborildi</p>
            <p className="text-sm text-ink">
              «{sent}» — {kind === "borrow" ? "olish" : "qaytarish"} uchun kutubxonachi tasdig&apos;i kutilmoqda. Kitobni kutubxonachiga
              ko&apos;rsating.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
