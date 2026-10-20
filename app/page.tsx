import { Suspense } from "react";
import { ArrowRight, Award, BookOpen, KeyRound, Library, ListChecks, ScanLine, Trophy } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { getCurrentUser, homeFor } from "@/lib/auth";

const features = [
  {
    icon: ScanLine,
    title: "QR orqali berish va qabul",
    text: "O'quvchi kartasi va kitob yorlig'ini skaner qiling — qarz bir zumda qayd etiladi.",
  },
  {
    icon: ListChecks,
    title: "Kitob bo'yicha test",
    text: "Qaytarilgan kitob bo'yicha vaqtli test: o'qilganini adolatli tekshiradi.",
  },
  {
    icon: Trophy,
    title: "Reyting va sinflar bellashuvi",
    text: "Ball, o'rtacha natija va sinflar reytingi o'qishga rag'bat beradi.",
  },
  {
    icon: Award,
    title: "Marralar va Alfa",
    text: "5, 10, 20… kitob marralariga yetganda maktab valyutasi beriladi.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div className="pointer-events-none absolute -right-32 -top-40 size-[520px] rounded-full bg-brand-700/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-10 size-[420px] rounded-full bg-gold-500/20 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-6 sm:pb-28">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-gold-500 text-brand-900">
                <Library className="size-5" strokeWidth={2.4} />
              </span>
              <span className="font-bold">Maktab kutubxonasi</span>
            </div>
            <LinkButton href="/login" variant="secondary" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
              Kirish
            </LinkButton>
          </nav>

          <div className="mt-16 grid items-center gap-12 lg:mt-24 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-gold-400 ring-1 ring-white/15">
                <BookOpen className="size-4" /> Qishloq maktablari uchun
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
                Kitob o&apos;qishni <span className="text-gold-400">odatga</span> aylantiramiz
              </h1>
              <p className="mt-6 max-w-xl text-lg text-brand-100/85">
                Kitob berish, qaytarish, test va reyting — hammasi bitta ilovada. Internet shart emas: hamma narsa
                maktab kompyuterida ishlaydi.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Suspense fallback={<PrimaryCta href="/login" label="Kirish" />}>
                  <SessionCta />
                </Suspense>
                <LinkButton
                  href="/faollashtirish"
                  size="lg"
                  variant="secondary"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  <KeyRound className="size-4" /> Hisobni faollashtirish
                </LinkButton>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="relative mx-auto w-80 rotate-2 rounded-3xl bg-white p-6 text-ink shadow-pop">
                <p className="text-sm font-medium text-muted">Mening natijam</p>
                <p className="mt-1 text-4xl font-bold tabular-nums">
                  248 <span className="text-base font-semibold text-muted">ball</span>
                </p>
                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-paper-2">
                  <div className="h-full w-3/4 rounded-full bg-gold-500" />
                </div>
                <p className="mt-2 text-xs text-muted">Keyingi marragacha 2 ta kitob</p>
                <div className="mt-6 space-y-3">
                  {["O'tkan kunlar", "Sariq devni minib", "Shum bola"].map((t, i) => (
                    <div key={t} className="flex items-center gap-3 rounded-xl bg-paper p-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <BookOpen className="size-4" />
                      </span>
                      <span className="flex-1 text-sm font-semibold">{t}</span>
                      <span className="text-xs font-bold text-ok-600">{[90, 80, 100][i]}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-line/70 bg-white p-6 shadow-card">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <f.icon className="size-5" />
            </span>
            <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto border-t border-line/70 py-6 text-center text-sm text-muted">
        Maktab kutubxonasi · ma&apos;lumotlar faqat maktab serverida saqlanadi
      </footer>
    </main>
  );
}

function PrimaryCta({ href, label }: { href: string; label: string }) {
  return (
    <LinkButton href={href} size="lg" variant="gold">
      {label} <ArrowRight className="size-4" />
    </LinkButton>
  );
}

async function SessionCta() {
  const user = await getCurrentUser().catch(() => null);
  return user ? <PrimaryCta href={homeFor(user)} label="Panelga o'tish" /> : <PrimaryCta href="/login" label="Kirish" />;
}
