import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div>
        <h1 className="text-4xl font-bold text-[#1e3a8a]">Maktab kutubxonasi</h1>
        <p className="mx-auto mt-3 max-w-md text-lg text-[#3f3f46]">
          Kitob berish, qabul qilish va oʻqish ragʻbatlari bir joyda.
        </p>
      </div>

      <nav className="flex w-full max-w-sm flex-col gap-3">
        <Link href="/login" className="rounded-xl bg-[#1e3a8a] px-4 py-4 text-lg font-semibold text-white">
          Kirish
        </Link>
        <Link href="/kutubxonachi" className="rounded-xl border border-[#1e3a8a] px-4 py-4 text-lg font-semibold text-[#1e3a8a]">
          Kutubxonachi paneli
        </Link>
        <Link href="/o-quvchi" className="rounded-xl border border-[#1e3a8a] px-4 py-4 text-lg font-semibold text-[#1e3a8a]">
          Oʻquvchi sahifasi
        </Link>
      </nav>
    </main>
  );
}
