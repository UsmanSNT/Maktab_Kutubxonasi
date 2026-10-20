import Link from "next/link";

export default function StudentHome() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold text-[#1e3a8a]">Oʻquvchi sahifasi</h1>
      <p className="max-w-sm text-[#3f3f46]">Qoʻlingizdagi kitoblar, katalog va reyting shu yerda boʻladi. Tez orada.</p>
      <Link href="/" className="text-[#1e3a8a] underline">
        Bosh sahifa
      </Link>
    </main>
  );
}
