import Link from "next/link";

const sections = [
  { title: "Kitob berish", description: "QR orqali kitobni oʻquvchiga berish" },
  { title: "Qabul qilish", description: "Qaytarilgan kitoblarni qabul qilish" },
  { title: "Oʻquvchilar", description: "Roʻyxat va faollashtirish kodlari" },
  { title: "Kitoblar", description: "Katalog va nusxalar" },
];

export default function LibrarianHome() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header>
        <h1 className="text-3xl font-bold text-[#1e3a8a]">Kutubxonachi paneli</h1>
        <p className="mt-1 text-[#3f3f46]">Boʻlimni tanlang</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.title} className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#27272a]">{s.title}</h2>
            <p className="mt-1 text-[#52525b]">{s.description}</p>
            <span className="mt-3 inline-block text-sm text-[#a16207]">Tez orada</span>
          </div>
        ))}
      </div>

      <Link href="/" className="text-[#1e3a8a] underline">
        Bosh sahifa
      </Link>
    </main>
  );
}
