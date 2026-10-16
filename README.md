# Maktab kutubxonasi

O'zbekistondagi qishloq maktabi kutubxonasi uchun ilova. Kitob berish va qabul qilish QR kod orqali
raqamlashtiriladi; o'quvchilar test ishlab ball to'playdi, reyting va marralar bor.

Ilova pul to'lamaydi. Valyuta ("Alfa") faqat rag'bat va hisob daftari uchun.

Hamma narsa **o'z kompyuteringizda** (local) ishlaydi: PostgreSQL, Supabase Auth (GoTrue), PostgREST va
Next.js ilovasi. Bulutga hech narsa yuborilmaydi.

## Talablar

- Node.js 22+
- Docker va Docker Compose
- Bo'sh port: 3000 (ilova), 5432 (baza), 8000 (API shlyuzi)

## Birinchi ishga tushirish

```bash
npm install
npm run env:init     # .env yaratadi: parol, JWT kalit, anon/service_role kalitlari (bir marta)
npm run stack:up     # docker: db, auth, rest, api
npm run db:migrate   # migratsiyani dev bazaga qo'llaydi
npm run dev          # http://localhost:3000
```

`.env` faylni hech qachon repoga qo'shmang. Undagi kalitlarni yo'qotsangiz, `npm run env:init` yangisini
yaratadi, lekin eski sessiyalar va foydalanuvchilar ishlamay qoladi.

## Testlar

```bash
npm run db:test      # toza PostgreSQL 16 da: stub + migratsiya + 118 ta tekshiruv (RLS, RPC, ball, marra)
npm run lint
npm run typecheck
npm run build
```

`npm test` = `npm run db:test`. Har commitdan oldin barchasi o'tishi kerak.

## Tuzilma

```
app/                     Next.js (App Router) sahifalari
lib/env.ts               Muhit o'zgaruvchilarini tekshirish (faqat server)
lib/supabase/            server (foydalanuvchi sessiyasi) va admin (service_role) klientlari
supabase/migrations/     Ma'lumotlar bazasi sxemasi (001 — mavjud, o'zgartirilmaydi)
supabase/tests/          Auth "stub" (faqat test uchun) va test to'plami
supabase/stack/          Stek uchun rollar, JWT sozlamalari va nginx shlyuzi
scripts/                 env, stek, migratsiya va testlar
docker-compose.yml       db, auth, rest, api (+ test uchun db-test)
```

Biznes-qoidalar bazada (SECURITY DEFINER RPC va RLS). Frontend qoidalarni takrorlamaydi, faqat RPC'larni
chaqiradi. Bazani o'zgartirish kerak bo'lsa, yangi migratsiya (`002_...`) yoziladi.

`supabase/stack/db/` dagi fayllar Supabase loyihasidan olingan (Apache License 2.0).

## Eslatmalar

- Telegram bildirishnomalari keyingi bosqichda qo'shiladi (`002` migratsiya kerak bo'ladi).
- Bolalar shaxsiy ma'lumoti: ota-ona roziligi va saqlash muddatlari maktab ma'muriyati bilan yuridik
  tekshirilishi kerak. Bu loyiha kodi buni hal qilmaydi.
