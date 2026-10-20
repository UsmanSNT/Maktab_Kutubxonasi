# Loyiha holati va davom ettirish

Oxirgi yangilanish: 2026-10-20. Yangi kompyuterda (yoki yangi Claude sessiyasida) ishni shu fayldan boshlang.

## Nima tayyor

- Ma'lumotlar bazasi: `supabase/migrations/001_maktab_kutubxona.sql` (RLS, RPC, ball, marralar) va 118 ta test.
- Frontend to'liq yozilgan: kutubxonachi paneli, o'quvchi sahifasi, vaqtli test, faollashtirish (README'dagi "Ilova bo'limlari").
- `npm run db:seed` — demo maktab (kod `demo`), xodimlar, 12 o'quvchi, 12 kitob, "O'tkan kunlar" bo'yicha 10 savol.
- `typecheck`, `lint`, `build` xatosiz o'tadi.
- `docs/ekranlar-korinishi.html` — asosiy ekranlarning namunaviy ko'rinishi (brauzerda oching, bazasiz ishlaydi).

## Nima qilinmagan

- Ilova **hali haqiqiy baza bilan ishga tushirilmagan**: birinchi kompyuterda Docker yo'q edi.
  Birinchi ishga tushirishda xatolar chiqishi mumkin, ular tuzatiladi.
- Seed skripti `service_role` hamma jadvalga yoza oladi deb hisoblaydi — baza ko'tarilgach tekshiriladi.
- "O'tkan kunlar" demo savollarini o'qituvchi tekshirishi kerak.

## Keyingi qadamlar

1. Docker bor kompyuterda: `npm install`, `npm run env:init`, `npm run stack:up`, `npm run db:migrate`,
   `npm run db:test`, `npm run db:seed`, `npm run dev` → http://localhost:3001
2. Demo hisoblar bilan kirib sinash: kutubxonachi (berish, qabul, so'rovlar, kitob/savol qo'shish,
   o'quvchi qo'shish + faollashtirish kodi) va o'quvchi (skaner so'rovi, test, reyting).
3. Server (`desktop-hqpgd6g`, Tailscale) ga joylash: SSH kalit qo'shish, serverdagi boshqa loyihalarga
   tegmasdan bo'sh portlarni aniqlash, `npm run build && npm run start` yoki serverdagi boshqa loyihalar
   qanday ishlasa (PM2/Docker), shunday ishga tushirish.

## Muhim

- Repo ochiq (public). `.env`, parollar va haqiqiy o'quvchilar ma'lumoti hech qachon repoga qo'shilmaydi.
- Demo parollar (`kutubxona123`, `ustoz123`, `oquvchi123`) faqat sinov uchun.
