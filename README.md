# Maktab kutubxonasi

O'zbekistondagi qishloq maktabi kutubxonasi uchun ilova. Kitob berish va qabul qilish QR kod orqali
raqamlashtiriladi; o'quvchilar test ishlab ball to'playdi, reyting va marralar bor.

Ilova pul to'lamaydi. Valyuta ("Alfa") faqat rag'bat va hisob daftari uchun.

Hamma narsa **o'z kompyuteringizda** (local) ishlaydi: PostgreSQL, Supabase Auth (GoTrue), PostgREST va
Next.js ilovasi. Bulutga hech narsa yuborilmaydi.

## Talablar

- Node.js 22+
- Docker va Docker Compose
- Bo'sh port: 3001 (ilova), 5432 (baza), 8000 (API shlyuzi)

## Birinchi ishga tushirish

```bash
npm install
npm run env:init     # .env yaratadi: parol, JWT kalit, anon/service_role kalitlari (bir marta)
npm run stack:up     # docker: db, auth, rest, api
npm run db:migrate   # migratsiyani dev bazaga qo'llaydi
npm run db:seed      # ixtiyoriy: demo maktab, xodimlar, o'quvchilar, kitoblar va testlar
npm run dev          # http://localhost:3001
```

Demo ma'lumotlar bilan kirish (maktab kodi `demo`):

| Kim | ID | Parol |
| --- | --- | --- |
| Kutubxonachi + admin | `kutubxonachi` | `kutubxona123` |
| Sinf rahbari (7-A, berish/qabul ruxsati bor) | `ustoz` | `ustoz123` |
| O'quvchilar | `100001` … `100012` | `oquvchi123` |

Haqiqiy maktab uchun demo o'rniga birinchi xodimni qo'lda (service_role orqali) yarating yoki seed skriptidagi
maktab nomi va kodini o'zgartiring, keyin parollarni almashtiring.

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

## Ilova bo'limlari

**Kutubxonachi paneli** (`/kutubxonachi`) — rol bo'yicha ko'rinadi:

- Bosh panel: faol va kechikkan qarzlar, so'rovlar, oyning faol kitobxonlari, bildirishnomalar
- Kitob berish / qabul qilish: o'quvchi kartasi va kitob yorlig'i QR'ini skaner qilish (kamera, USB skaner yoki qo'lda)
- So'rovlar: o'quvchi telefonidan yuborgan so'rovlar va sinf rahbari qabul qilgan qaytarishlarni tasdiqlash
- Qarzlar: faol, kechikkan, tasdiq kutayotgan va qaytarilganlar
- Kitoblar: katalog, nusxalar, chop etiladigan QR yorliqlar, test savollari muharriri
- O'quvchilar: ro'yxat, sinflar, yangi foydalanuvchi + faollashtirish kodi, kutubxona kartalarini chop etish, rollar (admin)
- Reyting va sozlamalar (qoidalar, ball, marralar — admin o'zgartiradi)

**O'quvchi sahifasi** (`/o-quvchi`, telefonga moslangan): ball va valyuta, keyingi marra, qo'ldagi kitoblar,
katalog, kitob olish/qaytarish so'rovi uchun skaner, vaqtli test, reyting va shaxsiy QR karta.

**Faollashtirish** (`/faollashtirish`): o'quvchi kutubxonachi bergan bir martalik kod bilan o'ziga parol o'rnatadi.

QR yorliqlar ichida `K:<kod>` (kitob nusxasi) va `P:<kod>` (karta) yoziladi. Telefonda kamera faqat HTTPS yoki
`localhost` da ishlaydi; maktab tarmog'ida oddiy HTTP orqali kirilsa, kodni qo'lda yoki USB skaner bilan kiriting.

## Tuzilma

```
app/                     Next.js (App Router) sahifalari va server amallari
components/              Umumiy UI: dizayn elementlari, navigatsiya, QR skaner/generator, reyting
proxy.ts                 Sessiyani yangilash va kirmaganlarni /login ga yo'naltirish
lib/auth.ts              Joriy foydalanuvchi, rollar va ruxsat tekshiruvlari
lib/queries.ts           Bog'liq yozuvlarni (kitob, odam, sinf) id bo'yicha yig'ish
lib/env.ts               Muhit o'zgaruvchilarini tekshirish (faqat server)
lib/supabase/            server (foydalanuvchi sessiyasi) va admin (service_role) klientlari
supabase/migrations/     Ma'lumotlar bazasi sxemasi (001 — mavjud, o'zgartirilmaydi)
supabase/tests/          Auth "stub" (faqat test uchun) va test to'plami
supabase/stack/          Stek uchun rollar, JWT sozlamalari va nginx shlyuzi
scripts/                 env, stek, migratsiya, demo ma'lumotlar va testlar
docker-compose.yml       db, auth, rest, api (+ test uchun db-test)
```

Biznes-qoidalar bazada (SECURITY DEFINER RPC va RLS). Frontend qoidalarni takrorlamaydi, faqat RPC'larni
chaqiradi. Bazani o'zgartirish kerak bo'lsa, yangi migratsiya (`002_...`) yoziladi.

`supabase/stack/db/` dagi fayllar Supabase loyihasidan olingan (Apache License 2.0).

## Eslatmalar

- Telegram bildirishnomalari keyingi bosqichda qo'shiladi (`002` migratsiya kerak bo'ladi).
- Bolalar shaxsiy ma'lumoti: ota-ona roziligi va saqlash muddatlari maktab ma'muriyati bilan yuridik
  tekshirilishi kerak. Bu loyiha kodi buni hal qilmaydi.
