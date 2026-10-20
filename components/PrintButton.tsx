"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "./ui";

export function PrintButton({ label = "Chop etish" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")}>
      <Printer className="size-4" /> {label}
    </button>
  );
}
