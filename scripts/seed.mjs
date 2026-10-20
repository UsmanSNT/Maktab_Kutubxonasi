// Demo ma'lumotlar: maktab, xodimlar, sinflar, o'quvchilar, kitoblar, test savollari va
// reyting uchun bir nechta yakunlangan qarzlar. Ishga tushirish: npm run db:seed
// Qayta ishga tushirilsa, maktab bor bo'lsa hech narsa qilmaydi.
//
// Barcha biznes-amallar (qaytarish, test) haqiqiy RPC'lar orqali, foydalanuvchi sessiyasi bilan bajariladi.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error('.env topilmadi yoki to\'liq emas. Avval "npm run env:init" va "npm run stack:up".');
  process.exit(1);
}

const SCHOOL = { code: "demo", name: "1-son umumiy o'rta ta'lim maktabi" };
const PASSWORDS = { staff: "kutubxona123", teacher: "ustoz123", student: "oquvchi123" };

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);
const email = (login) => `${SCHOOL.code}.${login.toLowerCase()}@users.maktab.local`;

function must(res, what) {
  if (res.error) {
    console.error(`✗ ${what}:`, res.error.message ?? res.error);
    process.exit(1);
  }
  return res.data;
}

async function signIn(login, password) {
  const c = createClient(URL, ANON, opts);
  must(await c.auth.signInWithPassword({ email: email(login), password }), `kirish (${login})`);
  return c;
}

const DAY = 86400000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();

// ---------------------------------------------------------------------------

const existing = must(await admin.from("schools").select("id").eq("code", SCHOOL.code).maybeSingle(), "maktabni tekshirish");
if (existing) {
  console.log(`"${SCHOOL.code}" maktabi allaqachon bor — demo ma'lumotlar qayta yaratilmadi.`);
  process.exit(0);
}

const school = must(await admin.from("schools").insert(SCHOOL).select("id").single(), "maktab");
console.log("✓ Maktab:", SCHOOL.name);

async function person({ login, first, last, kind, password }) {
  const created = must(
    await admin.auth.admin.createUser({ email: email(login), password, email_confirm: true }),
    `foydalanuvchi ${login}`,
  );
  must(
    await admin.from("profiles").insert({
      id: created.user.id,
      school_id: school.id,
      kind,
      login_id: login,
      first_name: first,
      last_name: last,
    }),
    `profil ${login}`,
  );
  return created.user.id;
}

const librarian = await person({ login: "kutubxonachi", first: "Dilnoza", last: "Karimova", kind: "staff", password: PASSWORDS.staff });
must(
  await admin.from("memberships").insert([
    { school_id: school.id, profile_id: librarian, role: "librarian" },
    { school_id: school.id, profile_id: librarian, role: "admin" },
  ]),
  "kutubxonachi rollari",
);
const teacher = await person({ login: "ustoz", first: "Bahodir", last: "Rahimov", kind: "teacher", password: PASSWORDS.teacher });
must(
  await admin.from("memberships").insert({ school_id: school.id, profile_id: teacher, role: "class_teacher", can_circulate: true }),
  "sinf rahbari roli",
);
console.log("✓ Xodimlar");

const y = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
const year = must(
  await admin
    .from("academic_years")
    .insert({ school_id: school.id, label: `${y}-${y + 1}`, starts_on: `${y}-09-01`, ends_on: `${y + 1}-06-30`, is_current: true })
    .select("id")
    .single(),
  "o'quv yili",
);
const classRows = must(
  await admin
    .from("classes")
    .insert([
      { school_id: school.id, academic_year_id: year.id, name: "5-A", grade: 5 },
      { school_id: school.id, academic_year_id: year.id, name: "6-B", grade: 6 },
      { school_id: school.id, academic_year_id: year.id, name: "7-A", grade: 7, homeroom_profile_id: teacher },
    ])
    .select("id, name"),
  "sinflar",
);
const classId = Object.fromEntries(classRows.map((c) => [c.name, c.id]));

const STUDENTS = [
  ["Aziz", "Toshmatov", "7-A"],
  ["Madina", "Yusupova", "7-A"],
  ["Jasur", "Ergashev", "7-A"],
  ["Sevara", "Qodirova", "7-A"],
  ["Otabek", "Nurmatov", "6-B"],
  ["Malika", "Sobirova", "6-B"],
  ["Sardor", "Aliyev", "6-B"],
  ["Nilufar", "Hasanova", "6-B"],
  ["Bekzod", "Umarov", "5-A"],
  ["Zarina", "Mirzayeva", "5-A"],
  ["Doniyor", "Xolmatov", "5-A"],
  ["Gulnoza", "Rashidova", "5-A"],
];
const students = [];
for (const [i, [first, last, cls]] of STUDENTS.entries()) {
  const login = String(100001 + i);
  const id = await person({ login, first, last, kind: "student", password: PASSWORDS.student });
  must(
    await admin
      .from("enrollments")
      .insert({ school_id: school.id, student_id: id, class_id: classId[cls], academic_year_id: year.id }),
    "sinfga yozish",
  );
  students.push({ id, login, first, last });
}
console.log(`✓ Sinflar: 3, o'quvchilar: ${students.length}`);

const BOOKS = [
  { title: "O'tkan kunlar", author: "Abdulla Qodiriy", pages: 384, copies: 3 },
  { title: "Mehrobdan chayon", author: "Abdulla Qodiriy", pages: 312, copies: 2 },
  { title: "Shum bola", author: "G'afur G'ulom", pages: 176, copies: 3 },
  { title: "Sariq devni minib", author: "Xudoyberdi To'xtaboyev", pages: 240, copies: 3 },
  { title: "Kecha va kunduz", author: "Cho'lpon", pages: 352, copies: 2 },
  { title: "Ufq", author: "Said Ahmad", pages: 528, copies: 1 },
  { title: "Dunyoning ishlari", author: "O'tkir Hoshimov", pages: 224, copies: 2 },
  { title: "Bolalik", author: "Oybek", pages: 208, copies: 2 },
  { title: "Qutlug' qon", author: "Oybek", pages: 416, copies: 1 },
  { title: "Yulduzli tunlar", author: "Pirimqul Qodirov", pages: 480, copies: 2 },
  { title: "Kichkina shahzoda", author: "Antuan de Sent-Ekzyuperi", pages: 96, copies: 3 },
  { title: "Alpomish", author: "Xalq dostoni", pages: 272, copies: 2 },
];
const books = {};
for (const b of BOOKS) {
  const { copies, ...data } = b;
  const row = must(await admin.from("books").insert({ ...data, school_id: school.id }).select("id").single(), `kitob ${b.title}`);
  must(
    await admin.from("book_copies").insert(Array.from({ length: copies }, (_, i) => ({ school_id: school.id, book_id: row.id, copy_no: i + 1 }))),
    "nusxalar",
  );
  books[b.title] = row.id;
}
console.log(`✓ Kitoblar: ${BOOKS.length}`);

// "O'tkan kunlar" uchun 10 ta savol — test to'liq ishlashi uchun (standart: 10 savol).
const QUESTIONS = [
  ["Romanning bosh qahramoni kim?", ["Otabek", "Anvar", "Homid", "Hasanali"], 0],
  ["Otabekning sevgilisi va rafiqasi kim?", ["Kumush", "Zaynab", "Ra'no", "Oftob oyim"], 0],
  ["Kumush qaysi shahardan edi?", ["Marg'ilon", "Toshkent", "Buxoro", "Samarqand"], 0],
  ["Otabekning otasi kim?", ["Yusufbek hoji", "Mirzakarim qutidor", "Solih maxdum", "Hasanali"], 0],
  ["Kumushning otasi kim edi?", ["Mirzakarim qutidor", "Yusufbek hoji", "Homid", "Qutidor Rahmat"], 0],
  ["Otabek qaysi shaharlik edi?", ["Toshkent", "Marg'ilon", "Qo'qon", "Xiva"], 0],
  ["Otabekning ikkinchi xotini kim bo'ldi?", ["Zaynab", "Kumush", "Xushro'y", "Ra'no"], 0],
  ["Asardagi asosiy salbiy qahramon kim?", ["Homid", "Hasanali", "Yusufbek hoji", "Otabek"], 0],
  ["Otabekning sodiq xizmatkori kim?", ["Hasanali", "Homid", "Sodiq", "Jannat"], 0],
  ["Romanning muallifi kim?", ["Abdulla Qodiriy", "Cho'lpon", "Oybek", "G'afur G'ulom"], 0],
];
const keyOf = {};
for (const [body, options, correct] of QUESTIONS) {
  const q = must(
    await admin
      .from("quiz_questions")
      .insert({ school_id: school.id, book_id: books["O'tkan kunlar"], body, status: "draft", created_by: librarian })
      .select("id")
      .single(),
    "savol",
  );
  const opts = must(await admin.from("quiz_options").insert(options.map((o) => ({ question_id: q.id, body: o }))).select("id, body"), "variantlar");
  const key = opts.find((o) => o.body === options[correct]).id;
  must(await admin.from("quiz_answer_keys").insert({ question_id: q.id, correct_option_id: key }), "javob kaliti");
  must(
    await admin
      .from("quiz_questions")
      .update({ status: "approved", approved_by: librarian, approved_at: new Date().toISOString() })
      .eq("id", q.id),
    "tasdiqlash",
  );
  keyOf[q.id] = key;
}
console.log(`✓ Test savollari: ${QUESTIONS.length}`);

// ---------------------------------------------------------------------------
// Tarix: o'tgan qarzlar (sana o'tmishda) -> kutubxonachi RPC orqali qabul qiladi -> o'quvchi test ishlaydi.
// ---------------------------------------------------------------------------

const copies = must(await admin.from("book_copies").select("id, book_id, copy_no"), "nusxalar ro'yxati");
const codes = must(await admin.from("copy_codes").select("copy_id, qr_code"), "QR kodlar");
const qrOf = Object.fromEntries(codes.map((c) => [c.copy_id, c.qr_code]));
const copyOf = (title, no = 1) => copies.find((c) => c.book_id === books[title] && c.copy_no === no);

async function pastLoan(student, title, copyNo, borrowedDaysAgo) {
  const copy = copyOf(title, copyNo);
  must(
    await admin.from("loans").insert({
      school_id: school.id,
      copy_id: copy.id,
      book_id: copy.book_id,
      borrower_id: student.id,
      borrowed_at: ago(borrowedDaysAgo),
      due_at: ago(borrowedDaysAgo - 14),
      issued_by: librarian,
    }),
    "qarz",
  );
  return copy;
}

const lib = await signIn("kutubxonachi", PASSWORDS.staff);

// [o'quvchi indeksi, kitob, to'g'ri javoblar ulushi]
const HISTORY = [
  [0, "O'tkan kunlar", 1.0],
  [0, "Shum bola"],
  [0, "Bolalik"],
  [1, "O'tkan kunlar", 0.9],
  [1, "Kichkina shahzoda"],
  [2, "O'tkan kunlar", 0.7],
  [3, "Dunyoning ishlari"],
  [3, "Sariq devni minib"],
  [4, "O'tkan kunlar", 0.8],
  [5, "Shum bola"],
  [6, "Alpomish"],
  [8, "Sariq devni minib"],
  [9, "Kichkina shahzoda"],
  [9, "Bolalik"],
];

for (const [idx, title, accuracy] of HISTORY) {
  const s = students[idx];
  const copy = await pastLoan(s, title, 1, 12 + idx);
  must(await lib.rpc("record_return", { p_op_id: randomUUID(), p_copy_qr: qrOf[copy.id] }), `qaytarish ${title}`);

  if (accuracy !== undefined) {
    const c = await signIn(s.login, PASSWORDS.student);
    const quizzes = must(await c.rpc("my_quizzes"), "testlar");
    const attempt = quizzes[0];
    let state = must(await c.rpc("quiz_start_or_resume", { p_attempt_id: attempt.attempt_id, p_fresh_load: false }), "testni boshlash");
    for (let i = 0; i < 50; i++) {
      const q = must(await c.rpc("quiz_next_question", { p_attempt_id: attempt.attempt_id, p_run_no: state.run_no }), "savol");
      if (q.finished) break;
      const right = Math.random() < accuracy;
      const option = right ? keyOf[q.question_id] : q.options.find((o) => o.id !== keyOf[q.question_id]).id;
      const r = must(
        await c.rpc("quiz_answer", { p_attempt_id: attempt.attempt_id, p_run_no: state.run_no, p_question_id: q.question_id, p_option_id: option }),
        "javob",
      );
      state = r.state;
      if (r.finished) break;
    }
    await c.auth.signOut();
  }
}
console.log(`✓ Tarix: ${HISTORY.length} ta qaytarilgan kitob, testlar ishlandi`);

// Hozirgi holat: qo'ldagi kitoblar (biri muddati o'tgan) va bitta kutilayotgan so'rov.
const overdue = copyOf("Kecha va kunduz", 1);
must(
  await admin.from("loans").insert({
    school_id: school.id,
    copy_id: overdue.id,
    book_id: overdue.book_id,
    borrower_id: students[7].id,
    borrowed_at: ago(20),
    due_at: ago(6),
    issued_by: librarian,
  }),
  "kechikkan qarz",
);
for (const [idx, title, no] of [
  [1, "O'tkan kunlar", 2],
  [2, "Mehrobdan chayon", 1],
  [10, "Shum bola", 2],
]) {
  must(
    await lib.rpc("issue_loan", { p_loan_id: randomUUID(), p_copy_id: copyOf(title, no).id, p_borrower_id: students[idx].id }),
    "kitob berish",
  );
}
const requester = await signIn(students[11].login, PASSWORDS.student);
must(await requester.rpc("create_loan_request", { p_kind: "borrow", p_copy_qr: qrOf[copyOf("Ufq", 1).id] }), "so'rov");
await requester.auth.signOut();
await lib.auth.signOut();
console.log("✓ Faol qarzlar va so'rov");

console.log(`
Tayyor! Kirish ma'lumotlari (maktab kodi: ${SCHOOL.code}):
  Kutubxonachi + admin : ID kutubxonachi  parol ${PASSWORDS.staff}
  Sinf rahbari (7-A)   : ID ustoz         parol ${PASSWORDS.teacher}
  O'quvchilar          : ID 100001…100012 parol ${PASSWORDS.student}
Bular faqat sinov uchun. Haqiqiy foydalanishda parollarni almashtiring.`);
