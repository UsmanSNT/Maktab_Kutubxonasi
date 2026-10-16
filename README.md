# Maktab kutubxonasi

O'zbekistondagi qishloq maktabi kutubxonasi uchun ilova. Kitob berish va qabul qilish QR kod orqali
raqamlashtiriladi; o'quvchilar test ishlab ball to'playdi, reyting va marralar bor.

Ilova pul to'lamaydi. Valyuta ("Alfa") faqat rag'bat va hisob daftari uchun.

Server **o'z kompyuteringizda** (local) ishlaydi. Ma'lumotlar bazasi PostgreSQL 16, ilova Next.js.

## Talablar

- Node.js 22+
- Docker (PostgreSQL uchun) yoki o'rnatilgan PostgreSQL 16 va `psql`

## Ishga tushirish

```bash
cp .env.example .env.local
npm install
npm run db:up      # PostgreSQL konteynerini ishga tushiradi (Docker kerak)
npm run db:reset   # dev bazani yaratadi va migratsiyani qo'llaydi
npm run dev        # http://localhost:3000
```

## Testlar

```bash
npm run db:test    # migratsiya + 118 ta ma'lumotlar bazasi tekshiruvi (RLS, RPC, ball, marra)
npm run lint
npm run typecheck
npm run build
```

`npm test` = `npm run db:test`. Har commitdan oldin barchasi o'tishi kerak.

## Tuzilma

```
app/                 Next.js (App Router) sahifalari
supabase/migrations/ Ma'lumotlar bazasi sxemasi (001 — mavjud, o'zgartirilmaydi)
supabase/tests/      Auth "stub" (Supabase o'rnida) va test to'plami
scripts/db.sh        up / reset / test buyruqlari
docker-compose.yml   Mahalliy PostgreSQL 16
```

Biznes-qoidalar bazada (SECURITY DEFINER RPC va RLS). Frontend qoidalarni takrorlamaydi, faqat RPC'larni
chaqiradi. Bazani o'zgartirish kerak bo'lsa, yangi migratsiya (`002_...`) yoziladi.

## Eslatmalar

- Telegram bildirishnomalari keyingi bosqichda qo'shiladi (`002` migratsiya kerak bo'ladi).
- Bolalar shaxsiy ma'lumoti: ota-ona roziligi va saqlash muddatlari maktab ma'muriyati bilan yuridik
  tekshirilishi kerak. Bu loyiha kodi buni hal qilmaydi.
- `.env*` fayllari repoga qo'shilmaydi. Parollar va kalitlar faqat mahalliy `.env.local` da bo'ladi.
