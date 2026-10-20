import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, Library, ScanLine, Trophy } from "lucide-react";

// Kirish va faollashtirish sahifalari uchun ikki ustunli maket.
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-700/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-gold-500/20 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-gold-500 text-brand-900">
            <Library className="size-6" strokeWidth={2.4} />
          </span>
          <span className="text-lg font-bold">Maktab kutubxonasi</span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Har bir kitob — <span className="text-gold-400">yangi marra.</span>
          </h2>
          <p className="mt-4 text-lg text-brand-100/85">
            QR kod bilan kitob oling, o&apos;qing, test ishlang va reytingda yuqorilang.
          </p>
          <ul className="mt-10 space-y-4 text-brand-100">
            {[
              { icon: ScanLine, text: "Kitob berish va qaytarish — bir skanerda" },
              { icon: BookOpen, text: "O'qilgan kitob bo'yicha qisqa test" },
              { icon: Trophy, text: "Ball, marralar va sinflar reytingi" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-white/10 text-gold-400">
                  <f.icon className="size-[18px]" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-brand-200">Barcha ma&apos;lumotlar maktab kompyuterida saqlanadi.</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-700 text-gold-400">
              <Library className="size-5" strokeWidth={2.4} />
            </span>
            <span className="font-bold text-ink">Maktab kutubxonasi</span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
