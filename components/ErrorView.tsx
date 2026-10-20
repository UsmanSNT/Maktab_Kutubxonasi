"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { buttonClass } from "./ui";

export function ErrorView({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-line/70 bg-white p-10 text-center shadow-card">
      <span className="grid size-14 place-items-center rounded-2xl bg-bad-50 text-bad-600">
        <TriangleAlert className="size-7" />
      </span>
      <h2 className="text-xl font-bold text-ink">Nimadir xato ketdi</h2>
      <p className="max-w-sm text-sm text-muted">
        Server bilan bog&apos;lanib bo&apos;lmadi. Kutubxona serveri (baza) ishlayotganini tekshiring va qayta urinib ko&apos;ring.
      </p>
      <button type="button" onClick={reset} className={buttonClass("primary")}>
        <RefreshCw className="size-4" /> Qayta urinish
      </button>
    </div>
  );
}
