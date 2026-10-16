-- ============================================================================
-- MAKTAB KUTUBXONASI — ma'lumotlar bazasi sxemasi (001_init)
-- PostgreSQL 15+ / Supabase.
--
-- Talablar: auth.users, auth.uid(), rollar anon / authenticated / service_role
-- (Supabase'da tayyor).
--
-- Arxitektura qoidalari
--  * Mijoz (brauzer) jadvallarga faqat O'QISH huquqiga ega (RLS bilan).
--    Barcha yozish amallari SECURITY DEFINER RPC funksiyalar orqali bajariladi.
--  * To'g'ri javoblar (quiz_answer_keys) o'quvchi roliga hech qachon ko'rinmaydi.
--  * Vaqt faqat server soatida (now()). Mijoz vaqti faqat audit uchun saqlanadi.
--  * Pul emas, maktab valyutasi (standart nomi "Alfa") — coin_ledger, faqat qo'shiladi.
--  * Yordamchi funksiyalar `app` sxemasida (API orqali ochilmaydi).
--
-- Xato kodlari (RPC xabari): not_authenticated, forbidden, unknown_copy,
--  unknown_borrower, copy_not_active, copy_already_on_loan, borrower_has_this_book,
--  loan_id_conflict, no_open_loan, return_already_recorded, invalid_loan_state,
--  stale_run, no_open_question, not_current_question, invalid_option,
--  quiz_bank_too_small, attempt_not_found, copy_not_available, ...
-- ============================================================================

begin;

create schema if not exists app;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- 0. Kod generatorlari
-- ----------------------------------------------------------------------------

-- QR kodlar uchun: 9 bayt -> 12 belgi (URL-xavfsiz base64), taxminiy 72 bit.
create function app.new_code() returns text
language sql volatile set search_path = ''
as $$ select translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_') $$;

-- Faollashtirish kodi: 10 belgi, 32 harfli alifbo (ikkilanadigan belgilarsiz), ~50 bit.
-- 256 % 32 = 0, shuning uchun modulo og'ishi yo'q.
create function app.new_activation_code() returns text
language plpgsql volatile set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(10);
  v_out text := '';
begin
  for i in 0..9 loop
    v_out := v_out || substr(c_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_out;
end $$;

-- ----------------------------------------------------------------------------
-- 1. Maktab, sozlamalar
-- ----------------------------------------------------------------------------

create table public.schools (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[a-z0-9-]{2,32}$'),
  name          text not null check (length(btrim(name)) > 0),
  currency_name text not null default 'Alfa' check (length(btrim(currency_name)) between 1 and 32),
  created_at    timestamptz not null default now()
);

create table public.school_settings (
  school_id                  uuid primary key references public.schools (id) on delete cascade,
  loan_days                  int not null default 14  check (loan_days between 1 and 120),
  min_hold_days              int not null default 3   check (min_hold_days between 0 and 30),
  min_pages                  int not null default 30  check (min_pages >= 0),
  -- Test: qaytarilgandan keyin SHU vaqt ichida BOSHLASH (va qayta boshlash) kerak.
  quiz_start_window_minutes  int not null default 60  check (quiz_start_window_minutes between 1 and 1440),
  -- Har bir savolga beriladigan vaqt — alohida sozlama.
  quiz_seconds_per_question  int not null default 60  check (quiz_seconds_per_question between 5 and 600),
  quiz_network_grace_seconds int not null default 5   check (quiz_network_grace_seconds between 0 and 60),
  quiz_questions_per_attempt int not null default 10  check (quiz_questions_per_attempt between 1 and 50),
  quiz_max_exits             int not null default 5   check (quiz_max_exits between 1 and 20),
  base_points_per_book       int not null default 10  check (base_points_per_book between 0 and 1000),
  quiz_points_max            int not null default 30  check (quiz_points_max between 0 and 1000),
  class_points_cap           int not null default 600 check (class_points_cap > 0),
  overdue_notice_every_days  int not null default 3   check (overdue_notice_every_days between 1 and 30),
  updated_at                 timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Foydalanuvchilar
-- ----------------------------------------------------------------------------

-- id = auth.users.id. Foydalanuvchini faqat server (service_role) yaratadi.
-- Bolalarda email yo'qligi uchun ichki sintetik email: <maktab_kodi>.<login_id>@users.<domen>
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  school_id  uuid not null references public.schools (id),
  kind       text not null check (kind in ('student', 'teacher', 'staff')),
  login_id   text not null check (login_id ~ '^[A-Za-z0-9-]{3,32}$'),
  first_name text not null check (length(btrim(first_name)) > 0),
  last_name  text not null check (length(btrim(last_name)) > 0),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, login_id),
  unique (school_id, id)
);

-- Karta QR'i (login emas!). Faqat xodim skaneri shaxsni aniqlash uchun ishlatadi.
create table public.profile_codes (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  school_id   uuid not null references public.schools (id),
  public_code text not null unique default app.new_code(),
  rotated_at  timestamptz not null default now()
);

-- Bir martalik faollashtirish kodi: faqat hash saqlanadi.
create table public.activation_codes (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  code_hash       bytea not null,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  failed_attempts int not null default 0,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now()
);
create index activation_codes_profile on public.activation_codes (profile_id);

create table public.memberships (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null,
  profile_id   uuid not null,
  role         text not null check (role in ('librarian', 'admin', 'class_teacher', 'quiz_editor')),
  can_circulate boolean not null default false,  -- sinf rahbari uchun: berish/qabul qilish ruxsati
  created_at   timestamptz not null default now(),
  unique (profile_id, role),
  foreign key (school_id, profile_id) references public.profiles (school_id, id) on delete cascade
);

-- ----------------------------------------------------------------------------
-- 3. O'quv yili, sinflar
-- ----------------------------------------------------------------------------

create table public.academic_years (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools (id),
  label      text not null,
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  check (ends_on > starts_on),
  unique (school_id, label),
  unique (school_id, id)
);
create unique index academic_years_one_current on public.academic_years (school_id) where is_current;

create table public.classes (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null,
  academic_year_id    uuid not null,
  name                text not null check (length(btrim(name)) > 0),
  grade               int check (grade between 1 and 12),
  homeroom_profile_id uuid,
  unique (school_id, academic_year_id, name),
  unique (id, academic_year_id),
  unique (school_id, id),
  foreign key (school_id, academic_year_id) references public.academic_years (school_id, id),
  foreign key (school_id, homeroom_profile_id) references public.profiles (school_id, id)
);

create table public.enrollments (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null,
  student_id       uuid not null,
  class_id         uuid not null,
  academic_year_id uuid not null,
  created_at       timestamptz not null default now(),
  unique (student_id, academic_year_id),
  foreign key (school_id, student_id) references public.profiles (school_id, id) on delete cascade,
  foreign key (school_id, class_id) references public.classes (school_id, id),
  foreign key (class_id, academic_year_id) references public.classes (id, academic_year_id)
);
create index enrollments_class on public.enrollments (class_id);

-- ----------------------------------------------------------------------------
-- 4. Kitoblar, nusxalar
-- ----------------------------------------------------------------------------

create table public.books (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools (id),
  title      text not null check (length(btrim(title)) > 0),
  author     text not null default '',
  isbn       text,
  pages      int not null check (pages > 0),
  language   text not null default 'uz',
  created_at timestamptz not null default now(),
  unique (school_id, id)
);
create unique index books_isbn_uq on public.books (school_id, isbn) where isbn is not null;

create table public.book_copies (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null,
  book_id    uuid not null,
  copy_no    int not null check (copy_no > 0),
  condition  text not null default 'active' check (condition in ('active', 'lost', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (book_id, copy_no),
  unique (school_id, id),
  unique (id, book_id),
  foreign key (school_id, book_id) references public.books (school_id, id)
);

-- Nusxa QR'i alohida jadvalda: o'quvchilar kodlarni o'qiy olmasin.
create table public.copy_codes (
  copy_id    uuid primary key references public.book_copies (id) on delete cascade,
  school_id  uuid not null references public.schools (id),
  qr_code    text not null unique default app.new_code(),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. Berish / qabul qilish
-- ----------------------------------------------------------------------------

create table public.loans (
  id                     uuid primary key default gen_random_uuid(),  -- mijoz bergan id ham mumkin (idempotentlik)
  school_id              uuid not null,
  copy_id                uuid not null,
  book_id                uuid not null,
  borrower_id            uuid not null,
  status                 text not null default 'active' check (status in ('active', 'return_pending', 'returned')),
  borrowed_at            timestamptz not null default now(),
  due_at                 timestamptz not null,
  client_borrowed_at     timestamptz,
  issued_by              uuid not null references public.profiles (id),
  return_recorded_at     timestamptz,
  return_recorded_by     uuid references public.profiles (id),
  client_returned_at     timestamptz,
  return_op_id           uuid unique,
  return_verified_at     timestamptz,
  return_verified_by     uuid references public.profiles (id),
  scored                 boolean not null default false,
  not_scored_reason      text,
  base_points            int,
  last_overdue_notice_at timestamptz,
  created_at             timestamptz not null default now(),
  unique (school_id, id),
  check (due_at > borrowed_at),
  check (
    (status = 'active'         and return_recorded_at is null     and return_verified_at is null) or
    (status = 'return_pending' and return_recorded_at is not null and return_verified_at is null) or
    (status = 'returned'       and return_recorded_at is not null and return_verified_at is not null)
  ),
  check (not scored or (status = 'returned' and base_points is not null)),
  foreign key (school_id, copy_id) references public.book_copies (school_id, id),
  foreign key (copy_id, book_id) references public.book_copies (id, book_id),
  foreign key (school_id, borrower_id) references public.profiles (school_id, id)
);
-- Bir nusxa bir vaqtda faqat bitta odamda (parallel so'rovlarda ham bazaning o'zi kafolatlaydi).
create unique index loans_one_open_per_copy
  on public.loans (copy_id) where status in ('active', 'return_pending');
-- Bir o'quvchida bir kitobning ikkita ochiq nusxasi bo'lmaydi.
create unique index loans_one_open_per_borrower_book
  on public.loans (borrower_id, book_id) where status in ('active', 'return_pending');
-- Bir kitob bir odam uchun reytingga bir marta hisoblanadi.
create unique index loans_scored_one_per_book
  on public.loans (borrower_id, book_id) where scored;
create index loans_borrower on public.loans (borrower_id, status);
create index loans_open_due on public.loans (school_id, due_at) where status <> 'returned';

-- O'quvchi telefonidan QR skaner qilib yuborgan so'rovlar (xodim tasdiqlaydi).
create table public.loan_requests (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id),
  requester_id uuid not null references public.profiles (id),
  kind         text not null check (kind in ('borrow', 'return')),
  copy_id      uuid not null references public.book_copies (id),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  loan_id      uuid references public.loans (id),
  decided_by   uuid references public.profiles (id),
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  check ((status = 'pending') = (decided_at is null))
);
create unique index loan_requests_one_pending
  on public.loan_requests (requester_id, copy_id, kind) where status = 'pending';

-- ----------------------------------------------------------------------------
-- 6. Test banki va test sessiyalari
-- ----------------------------------------------------------------------------

create table public.quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null,
  book_id     uuid not null,
  body        text not null check (length(btrim(body)) between 3 and 1000),
  status      text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  created_by  uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (school_id, id),
  check (status <> 'approved' or approved_by is not null),
  foreign key (school_id, book_id) references public.books (school_id, id)
);
create index quiz_questions_book on public.quiz_questions (book_id) where status = 'approved';

create table public.quiz_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  body        text not null check (length(btrim(body)) between 1 and 500),
  unique (question_id, id)
);

-- To'g'ri javob alohida jadvalda. O'quvchi roliga hech qanday huquq/policy berilmaydi.
create table public.quiz_answer_keys (
  question_id       uuid primary key references public.quiz_questions (id) on delete cascade,
  correct_option_id uuid not null,
  foreign key (question_id, correct_option_id)
    references public.quiz_options (question_id, id) on delete cascade
);

create table public.quiz_attempts (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null,
  loan_id              uuid not null,
  student_id           uuid not null,
  book_id              uuid not null,
  status               text not null default 'pending'
                       check (status in ('pending', 'in_progress', 'completed', 'cancelled_exits', 'expired', 'voided')),
  start_deadline       timestamptz not null,
  -- Sozlamalar yaratilish paytida muzlatiladi (test o'rtasida o'zgarmaydi).
  max_points           int not null check (max_points >= 0),
  questions_total      int not null check (questions_total > 0),
  seconds_per_question int not null check (seconds_per_question > 0),
  grace_seconds        int not null check (grace_seconds >= 0),
  max_exits            int not null check (max_exits > 0),
  run_no               int not null default 0,
  exits                int not null default 0,
  started_at           timestamptz,
  finished_at          timestamptz,
  correct_count        int,
  score_bp             int check (score_bp between 0 and 10000),  -- bazis punkt: 10000 = 100%
  last_activity_at     timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  constraint quiz_attempts_completed_has_score
    check (status <> 'completed' or (score_bp is not null and correct_count is not null and finished_at is not null)),
  foreign key (school_id, loan_id) references public.loans (school_id, id),
  foreign key (school_id, student_id) references public.profiles (school_id, id),
  foreign key (school_id, book_id) references public.books (school_id, id)
);
-- Bitta qarz uchun bitta (bekor qilinmagan) urinish.
create unique index quiz_attempts_one_per_loan on public.quiz_attempts (loan_id) where status <> 'voided';
create index quiz_attempts_student on public.quiz_attempts (student_id, status);
create index quiz_attempts_open on public.quiz_attempts (start_deadline) where status in ('pending', 'in_progress');

create table public.quiz_attempt_items (
  attempt_id       uuid not null references public.quiz_attempts (id) on delete cascade,
  run_no           int not null,
  position         int not null check (position > 0),
  question_id      uuid not null references public.quiz_questions (id),
  option_order     uuid[] not null,
  served_at        timestamptz,
  deadline_at      timestamptz,
  answered_at      timestamptz,
  chosen_option_id uuid,
  is_correct       boolean,
  timed_out        boolean not null default false,
  primary key (attempt_id, run_no, position),
  unique (attempt_id, run_no, question_id)
);

-- ----------------------------------------------------------------------------
-- 7. Marralar va valyuta
-- ----------------------------------------------------------------------------

create table public.milestones (
  school_id    uuid not null references public.schools (id) on delete cascade,
  books        int not null check (books > 0),
  min_avg_bp   int not null default 8000 check (min_avg_bp between 0 and 10000),
  reward_total int not null check (reward_total >= 0),  -- shu marradagi JAMI summa (qo'shilmaydi)
  primary key (school_id, books)
);

-- Faqat qo'shiladigan hisob daftari. Balans = SUM(amount).
create table public.coin_ledger (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools (id),
  profile_id      uuid not null references public.profiles (id),
  amount          integer not null check (amount <> 0),
  kind            text not null check (kind in ('milestone', 'redemption', 'adjustment')),
  milestone_books integer check (milestone_books > 0),
  note            text,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  check ((kind = 'milestone') = (milestone_books is not null))
);
create unique index coin_ledger_one_milestone
  on public.coin_ledger (profile_id, milestone_books) where kind = 'milestone';
create index coin_ledger_profile on public.coin_ledger (profile_id);

-- ----------------------------------------------------------------------------
-- 8. Bildirishnomalar va audit
-- ----------------------------------------------------------------------------

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind         text not null,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  delivered_at timestamptz  -- Telegram bot ishchisi belgilaydi
);
create index notifications_recipient on public.notifications (recipient_id, created_at desc);
create index notifications_undelivered on public.notifications (created_at) where delivered_at is null;

create table public.audit_log (
  id        bigint generated always as identity primary key,
  school_id uuid references public.schools (id),
  actor_id  uuid,
  action    text not null,
  entity    text not null,
  entity_id uuid,
  details   jsonb not null default '{}'::jsonb,
  at        timestamptz not null default now()
);
create index audit_log_school_at on public.audit_log (school_id, at desc);

-- ----------------------------------------------------------------------------
-- 9. Triggerlar
-- ----------------------------------------------------------------------------

create function app.forbid_mutation() returns trigger
language plpgsql set search_path = ''
as $$ begin raise exception 'append_only_table: %', tg_table_name using errcode = '42501'; end $$;

create trigger coin_ledger_append_only before update or delete on public.coin_ledger
  for each row execute function app.forbid_mutation();
create trigger coin_ledger_no_truncate before truncate on public.coin_ledger
  for each statement execute function app.forbid_mutation();
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function app.forbid_mutation();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function app.forbid_mutation();

-- Yangi maktab: standart sozlamalar va marralar (5, 10, 20, 30 ... 100; jami = 10 x kitoblar soni).
create function app.seed_school_defaults() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.school_settings (school_id) values (new.id);
  insert into public.milestones (school_id, books, min_avg_bp, reward_total)
  select new.id, b, 8000, b * 10 from unnest(array[5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) as b;
  return new;
end $$;
create trigger schools_seed after insert on public.schools
  for each row execute function app.seed_school_defaults();

create function app.create_profile_code() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profile_codes (profile_id, school_id) values (new.id, new.school_id);
  return new;
end $$;
create trigger profiles_code after insert on public.profiles
  for each row execute function app.create_profile_code();

create function app.create_copy_code() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.copy_codes (copy_id, school_id) values (new.id, new.school_id);
  return new;
end $$;
create trigger book_copies_code after insert on public.book_copies
  for each row execute function app.create_copy_code();

-- Savol tasdiqlanishi uchun kamida 2 variant va to'g'ri javob kerak.
create function app.quiz_question_approval_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'approved' then
    if (select count(*) from public.quiz_options o where o.question_id = new.id) < 2 then
      raise exception 'question_needs_options';
    end if;
    if not exists (select 1 from public.quiz_answer_keys k where k.question_id = new.id) then
      raise exception 'question_needs_answer_key';
    end if;
    if new.approved_by is null then
      new.approved_by := auth.uid();
      new.approved_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger quiz_questions_approval before insert or update of status on public.quiz_questions
  for each row execute function app.quiz_question_approval_guard();

-- Tasdiqlangan savolning variantlari/javobi o'zgartirilmaydi (avval draft'ga qaytariladi).
create function app.quiz_content_lock() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
begin
  select q.status into v_status
  from public.quiz_questions q
  where q.id = coalesce(new.question_id, old.question_id);
  if v_status = 'approved' then
    raise exception 'approved_question_is_locked';
  end if;
  return coalesce(new, old);
end $$;
create trigger quiz_options_lock before insert or update or delete on public.quiz_options
  for each row execute function app.quiz_content_lock();
create trigger quiz_keys_lock before insert or update or delete on public.quiz_answer_keys
  for each row execute function app.quiz_content_lock();

-- ----------------------------------------------------------------------------
-- 10. Yordamchi funksiyalar (RLS siyosatlarida ham ishlatiladi)
-- ----------------------------------------------------------------------------

create function app.current_school_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.school_id from public.profiles p where p.id = (select auth.uid()) and p.is_active
$$;

create function app.has_role(p_role text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.profile_id
    where m.profile_id = (select auth.uid()) and m.role = p_role and p.is_active
  )
$$;

create function app.is_staff() returns boolean  -- kutubxonachi yoki admin
language sql stable security definer set search_path = ''
as $$ select app.has_role('librarian') or app.has_role('admin') $$;

create function app.is_quiz_editor() returns boolean
language sql stable security definer set search_path = ''
as $$ select app.has_role('librarian') or app.has_role('admin') or app.has_role('quiz_editor') $$;

create function app.is_homeroom_of(p_student uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    join public.academic_years y on y.id = c.academic_year_id and y.is_current
    where e.student_id = p_student
      and c.homeroom_profile_id = (select auth.uid())
      and e.school_id = app.current_school_id()
  )
$$;

create function app.profile_is_privileged(p_profile uuid) returns boolean  -- kutubxonachi yoki admin rolidagi odam
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.profile_id = p_profile and m.role in ('librarian', 'admin')
  )
$$;

-- Berish/qabul qilishga haqli xodim: kutubxonachi yoki "can_circulate" ruxsatli sinf rahbari.
create function app.is_circulator() returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.has_role('librarian') or exists (
    select 1 from public.memberships m
    join public.profiles p on p.id = m.profile_id
    where m.profile_id = (select auth.uid()) and m.role = 'class_teacher' and m.can_circulate and p.is_active
  )
$$;

create function app.can_circulate_for(p_borrower uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.current_school_id() is not null
    and exists (
      select 1 from public.profiles b
      where b.id = p_borrower and b.school_id = app.current_school_id() and b.is_active
    )
    and (app.has_role('librarian') or (app.is_circulator() and app.is_homeroom_of(p_borrower)))
$$;

create function app.audit(p_school uuid, p_actor uuid, p_action text, p_entity text, p_entity_id uuid,
                          p_details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_log (school_id, actor_id, action, entity, entity_id, details)
  values (p_school, p_actor, p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

create function app.notify(p_school uuid, p_recipient uuid, p_kind text, p_payload jsonb) returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (school_id, recipient_id, kind, payload)
  values (p_school, p_recipient, p_kind, coalesce(p_payload, '{}'::jsonb))
$$;

create function app.notify_librarians(p_school uuid, p_kind text, p_payload jsonb) returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (school_id, recipient_id, kind, payload)
  select p_school, m.profile_id, p_kind, coalesce(p_payload, '{}'::jsonb)
  from public.memberships m
  join public.profiles p on p.id = m.profile_id and p.is_active
  where m.school_id = p_school and m.role = 'librarian'
$$;

-- Reytingga hisoblanadigan har bir qarz uchun ball (muzlatilgan koeffitsientlar bilan).
-- Test bali faqat 'completed' holatda qo'shiladi; bekor qilingan/muddati o'tgan testda
-- faqat kitob uchun bazaviy ball beriladi.
create view app.scored_loan_points as
select
  l.id            as loan_id,
  l.school_id,
  l.borrower_id,
  l.book_id,
  l.return_verified_at as verified_at,
  l.base_points
    + case when a.id is not null then (a.max_points * a.score_bp + 5000) / 10000 else 0 end as points,
  a.score_bp      as score_bp   -- faqat tugatilgan test uchun; aks holda NULL
from public.loans l
left join public.quiz_attempts a on a.loan_id = l.id and a.status = 'completed'
where l.status = 'returned' and l.scored;

-- ----------------------------------------------------------------------------
-- 11. Marra hisobi
-- ----------------------------------------------------------------------------

-- Yaroqli kitob = tasdiqlangan, hisoblanadigan, testi TUGATILGAN kitob.
-- Marraga yetish: yaroqli kitoblar soni >= M va ularning o'rtacha test natijasi >= min_avg_bp.
-- Berilgan summa jami qiymatga to'ldiriladi (qo'shilib ketmaydi). Daftardan ayirilmaydi.
create function app.award_milestones(p_profile uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_school  uuid;
  v_kind    text;
  v_count   int;
  v_sum     bigint;
  v_best    public.milestones;
  v_accrued int;
  v_amount  int;
  v_rows    int;
begin
  select p.school_id, p.kind into v_school, v_kind from public.profiles p where p.id = p_profile;
  if v_kind is distinct from 'student' then
    return;  -- o'qituvchilar faqat reytingda ishtirok etadi
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_profile::text, 0));

  select count(*), coalesce(sum(a.score_bp), 0)
  into v_count, v_sum
  from public.loans l
  join public.quiz_attempts a on a.loan_id = l.id and a.status = 'completed'
  where l.borrower_id = p_profile and l.status = 'returned' and l.scored;

  if v_count = 0 then
    return;
  end if;

  select m.* into v_best
  from public.milestones m
  where m.school_id = v_school
    and m.books <= v_count
    and v_sum >= m.min_avg_bp::bigint * v_count   -- butun sonlar bilan taqqoslash
  order by m.books desc
  limit 1;
  if not found then
    return;
  end if;

  select coalesce(sum(c.amount), 0) into v_accrued
  from public.coin_ledger c
  where c.profile_id = p_profile and c.kind = 'milestone';

  v_amount := v_best.reward_total - v_accrued;
  if v_amount <= 0 then
    return;
  end if;

  insert into public.coin_ledger (school_id, profile_id, amount, kind, milestone_books, note)
  values (v_school, p_profile, v_amount, 'milestone', v_best.books, 'milestone_reached')
  on conflict (profile_id, milestone_books) where kind = 'milestone' do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    perform app.notify(v_school, p_profile, 'milestone',
      jsonb_build_object('books', v_best.books, 'amount', v_amount, 'total', v_accrued + v_amount));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 12. Berish / qabul qilish (ichki funksiyalar)
-- ----------------------------------------------------------------------------

-- Qarz reytingga hisoblanadimi? NULL = ha, aks holda sabab kodi.
create function app.loan_eligibility(p_loan public.loans) returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_set   public.school_settings;
  v_pages int;
begin
  if p_loan.return_recorded_at is null then
    raise exception 'return_not_recorded';
  end if;
  select * into v_set from public.school_settings where school_id = p_loan.school_id;
  select b.pages into v_pages from public.books b where b.id = p_loan.book_id;

  if v_pages < v_set.min_pages then
    return 'too_few_pages';
  end if;
  if p_loan.return_recorded_at - p_loan.borrowed_at < make_interval(days => v_set.min_hold_days) then
    return 'held_too_briefly';
  end if;
  if exists (
    select 1 from public.loans o
    where o.borrower_id = p_loan.borrower_id and o.book_id = p_loan.book_id
      and o.scored and o.id <> p_loan.id
  ) then
    return 'book_already_counted';
  end if;
  return null;
end $$;

create function app.create_quiz_attempt(p_loan public.loans) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_set  public.school_settings;
  v_bank int;
  v_id   uuid;
begin
  if app.loan_eligibility(p_loan) is not null then
    return null;
  end if;
  select * into v_set from public.school_settings where school_id = p_loan.school_id;
  select count(*) into v_bank
  from public.quiz_questions q
  where q.book_id = p_loan.book_id and q.status = 'approved';
  if v_bank < v_set.quiz_questions_per_attempt then
    return null;  -- test banki yetarli emas: test taklif qilinmaydi
  end if;

  insert into public.quiz_attempts (
    school_id, loan_id, student_id, book_id, start_deadline,
    max_points, questions_total, seconds_per_question, grace_seconds, max_exits)
  values (
    p_loan.school_id, p_loan.id, p_loan.borrower_id, p_loan.book_id,
    p_loan.return_recorded_at + make_interval(mins => v_set.quiz_start_window_minutes),
    v_set.quiz_points_max, v_set.quiz_questions_per_attempt, v_set.quiz_seconds_per_question,
    v_set.quiz_network_grace_seconds, v_set.quiz_max_exits)
  returning id into v_id;
  return v_id;
end $$;

create function app.apply_verification(p_loan_id uuid) returns public.loans
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan   public.loans;
  v_reason text;
begin
  select * into v_loan from public.loans where id = p_loan_id;
  v_reason := app.loan_eligibility(v_loan);
  update public.loans l
  set scored = (v_reason is null),
      not_scored_reason = v_reason,
      base_points = case when v_reason is null
        then (select s.base_points_per_book from public.school_settings s where s.school_id = l.school_id) end
  where l.id = p_loan_id
  returning * into v_loan;
  perform app.award_milestones(v_loan.borrower_id);
  return v_loan;
end $$;

create function app.issue_loan_internal(p_loan_id uuid, p_copy_id uuid, p_borrower_id uuid,
                                        p_actor uuid, p_client_ts timestamptz) returns public.loans
language plpgsql security definer set search_path = ''
as $$
declare
  v_copy       public.book_copies;
  v_set        public.school_settings;
  v_loan       public.loans;
  v_constraint text;
begin
  -- Idempotentlik: bir xil id bilan takroriy yuborish (oflayn sinxron) dublikat yaratmaydi.
  select * into v_loan from public.loans where id = p_loan_id;
  if found then
    if v_loan.copy_id = p_copy_id and v_loan.borrower_id = p_borrower_id then
      return v_loan;
    end if;
    raise exception 'loan_id_conflict' using errcode = '23505';
  end if;

  select * into v_copy from public.book_copies where id = p_copy_id for update;
  if not found then
    raise exception 'unknown_copy';
  end if;
  if v_copy.condition <> 'active' then
    raise exception 'copy_not_active';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_borrower_id and p.school_id = v_copy.school_id and p.is_active
  ) then
    raise exception 'unknown_borrower';
  end if;
  select * into v_set from public.school_settings where school_id = v_copy.school_id;

  begin
    insert into public.loans (id, school_id, copy_id, book_id, borrower_id, borrowed_at, due_at,
                              client_borrowed_at, issued_by)
    values (p_loan_id, v_copy.school_id, v_copy.id, v_copy.book_id, p_borrower_id, now(),
            now() + make_interval(days => v_set.loan_days), p_client_ts, p_actor)
    returning * into v_loan;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'loans_one_open_per_copy' then
      raise exception 'copy_already_on_loan' using errcode = '23505';
    elsif v_constraint = 'loans_one_open_per_borrower_book' then
      raise exception 'borrower_has_this_book' using errcode = '23505';
    else
      raise;
    end if;
  end;

  perform app.audit(v_loan.school_id, p_actor, 'loan_issued', 'loan', v_loan.id,
    jsonb_build_object('copy_id', v_loan.copy_id, 'borrower_id', v_loan.borrower_id,
                       'client_ts', p_client_ts));
  return v_loan;
end $$;

-- p_verified = true: kutubxonachi qabul qildi (darhol tasdiqlanadi).
-- p_verified = false: sinf rahbari qabul qildi (kutubxonachi tasdiqlashi kerak).
create function app.record_return_internal(p_loan_id uuid, p_actor uuid, p_verified boolean,
                                           p_client_ts timestamptz, p_op_id uuid) returns public.loans
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
begin
  update public.loans l
  set status = case when p_verified then 'returned' else 'return_pending' end,
      return_recorded_at = now(),
      return_recorded_by = p_actor,
      client_returned_at = p_client_ts,
      return_op_id = p_op_id,
      return_verified_at = case when p_verified then now() end,
      return_verified_by = case when p_verified then p_actor end
  where l.id = p_loan_id and l.status = 'active'
  returning * into v_loan;
  if not found then
    raise exception 'invalid_loan_state';
  end if;

  perform app.audit(v_loan.school_id, p_actor, 'return_recorded', 'loan', v_loan.id,
    jsonb_build_object('verified', p_verified, 'client_ts', p_client_ts));
  perform app.create_quiz_attempt(v_loan);
  if p_verified then
    v_loan := app.apply_verification(v_loan.id);
  end if;
  return v_loan;
end $$;

-- ----------------------------------------------------------------------------
-- 13. Berish / qabul qilish (RPC)
-- ----------------------------------------------------------------------------

create function public.issue_loan(p_loan_id uuid, p_copy_id uuid, p_borrower_id uuid,
                                  p_client_ts timestamptz default null) returns public.loans
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or app.current_school_id() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not app.can_circulate_for(p_borrower_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return app.issue_loan_internal(p_loan_id, p_copy_id, p_borrower_id, auth.uid(), p_client_ts);
end $$;

create function public.record_return(p_op_id uuid, p_copy_qr text,
                                     p_client_ts timestamptz default null) returns public.loans
language plpgsql security definer set search_path = ''
as $$
declare
  v_school uuid := app.current_school_id();
  v_loan   public.loans;
begin
  if auth.uid() is null or v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Takroriy yuborish (oflayn navbat): oldin qayd etilgan bo'lsa, o'shani qaytaradi.
  select * into v_loan from public.loans where return_op_id = p_op_id;
  if found then
    if v_loan.school_id = v_school then
      return v_loan;
    end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select l.* into v_loan
  from public.loans l
  join public.copy_codes cc on cc.copy_id = l.copy_id
  where cc.qr_code = p_copy_qr and cc.school_id = v_school
    and l.status in ('active', 'return_pending')
  for update of l;
  if not found then
    raise exception 'no_open_loan';
  end if;
  if v_loan.status = 'return_pending' then
    raise exception 'return_already_recorded';
  end if;
  if not app.can_circulate_for(v_loan.borrower_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return app.record_return_internal(v_loan.id, auth.uid(), app.has_role('librarian'), p_client_ts, p_op_id);
end $$;

-- Kutubxonachi sinf rahbari qayd etgan qaytarishni tasdiqlaydi yoki rad etadi.
-- Rad etilsa: qarz qayta ochiladi, test urinishi bekor qilinadi.
create function public.verify_return(p_loan_id uuid, p_accept boolean,
                                     p_note text default null) returns public.loans
language plpgsql security definer set search_path = ''
as $$
declare
  v_school uuid := app.current_school_id();
  v_loan   public.loans;
begin
  if auth.uid() is null or v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not app.has_role('librarian') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_loan from public.loans where id = p_loan_id and school_id = v_school for update;
  if not found then
    raise exception 'no_open_loan';
  end if;
  if v_loan.status = 'returned' and p_accept then
    return v_loan;  -- idempotent
  end if;
  if v_loan.status <> 'return_pending' then
    raise exception 'invalid_loan_state';
  end if;

  if p_accept then
    update public.loans
    set status = 'returned', return_verified_at = now(), return_verified_by = auth.uid()
    where id = p_loan_id;
    v_loan := app.apply_verification(p_loan_id);
    perform app.audit(v_school, auth.uid(), 'return_verified', 'loan', p_loan_id,
      jsonb_build_object('note', p_note));
  else
    update public.quiz_attempts
    set status = 'voided', finished_at = coalesce(finished_at, now())
    where loan_id = p_loan_id and status <> 'voided';

    update public.loans
    set status = 'active', return_recorded_at = null, return_recorded_by = null,
        client_returned_at = null, return_op_id = null
    where id = p_loan_id
    returning * into v_loan;

    perform app.audit(v_school, auth.uid(), 'return_rejected', 'loan', p_loan_id,
      jsonb_build_object('note', p_note));
    perform app.notify(v_school, v_loan.borrower_id, 'return_rejected',
      jsonb_build_object('loan_id', p_loan_id, 'note', p_note));
  end if;
  return v_loan;
end $$;

-- ----------------------------------------------------------------------------
-- 14. O'quvchi so'rovlari (o'z telefonidan skaner qilish)
-- ----------------------------------------------------------------------------

create function public.create_loan_request(p_kind text, p_copy_qr text) returns public.loan_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_school uuid := app.current_school_id();
  v_copy   public.book_copies;
  v_req    public.loan_requests;
begin
  if v_uid is null or v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_kind not in ('borrow', 'return') then
    raise exception 'invalid_kind';
  end if;

  select c.* into v_copy
  from public.copy_codes cc
  join public.book_copies c on c.id = cc.copy_id
  where cc.qr_code = p_copy_qr and cc.school_id = v_school;
  if not found then
    raise exception 'unknown_copy';
  end if;

  if p_kind = 'borrow' then
    if v_copy.condition <> 'active'
       or exists (select 1 from public.loans l where l.copy_id = v_copy.id and l.status in ('active', 'return_pending')) then
      raise exception 'copy_not_available';
    end if;
  else
    if not exists (select 1 from public.loans l
                   where l.copy_id = v_copy.id and l.borrower_id = v_uid and l.status = 'active') then
      raise exception 'no_open_loan';
    end if;
  end if;

  insert into public.loan_requests (school_id, requester_id, kind, copy_id)
  values (v_school, v_uid, p_kind, v_copy.id)
  on conflict (requester_id, copy_id, kind) where status = 'pending' do nothing
  returning * into v_req;

  if not found then
    select * into v_req from public.loan_requests r
    where r.requester_id = v_uid and r.copy_id = v_copy.id and r.kind = p_kind and r.status = 'pending';
  else
    perform app.notify_librarians(v_school, 'loan_request',
      jsonb_build_object('request_id', v_req.id, 'kind', p_kind, 'requester_id', v_uid, 'copy_id', v_copy.id));
  end if;
  return v_req;
end $$;

create function public.decide_loan_request(p_request_id uuid, p_approve boolean,
                                           p_loan_id uuid default gen_random_uuid()) returns public.loan_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_school uuid := app.current_school_id();
  v_req    public.loan_requests;
  v_loan   public.loans;
begin
  if auth.uid() is null or v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_req from public.loan_requests where id = p_request_id and school_id = v_school for update;
  if not found then
    raise exception 'unknown_request';
  end if;
  if not app.can_circulate_for(v_req.requester_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_req.status <> 'pending' then
    return v_req;  -- idempotent
  end if;

  if not p_approve then
    update public.loan_requests
    set status = 'rejected', decided_by = auth.uid(), decided_at = now()
    where id = p_request_id returning * into v_req;
    return v_req;
  end if;

  if v_req.kind = 'borrow' then
    v_loan := app.issue_loan_internal(p_loan_id, v_req.copy_id, v_req.requester_id, auth.uid(), null);
  else
    select * into v_loan from public.loans
    where copy_id = v_req.copy_id and borrower_id = v_req.requester_id and status = 'active'
    for update;
    if not found then
      raise exception 'no_open_loan';
    end if;
    v_loan := app.record_return_internal(v_loan.id, auth.uid(), app.has_role('librarian'), null, null);
  end if;

  update public.loan_requests
  set status = 'approved', loan_id = v_loan.id, decided_by = auth.uid(), decided_at = now()
  where id = p_request_id returning * into v_req;
  return v_req;
end $$;

-- ----------------------------------------------------------------------------
-- 15. Skaner yordamchilari (xodim uchun)
-- ----------------------------------------------------------------------------

create function public.find_profile_by_code(p_code text)
returns table (profile_id uuid, first_name text, last_name text, kind text, class_name text)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school uuid := app.current_school_id();
begin
  if v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return query
  select p.id, p.first_name, p.last_name, p.kind, cl.name
  from public.profile_codes pc
  join public.profiles p on p.id = pc.profile_id
  left join lateral (
    select c.name
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    join public.academic_years y on y.id = c.academic_year_id and y.is_current
    where e.student_id = p.id
    limit 1
  ) cl on true
  where pc.public_code = p_code and pc.school_id = v_school and p.is_active
    and app.can_circulate_for(p.id);
end $$;

create function public.find_copy_by_qr(p_qr text)
returns table (copy_id uuid, book_id uuid, title text, copy_no int, condition text,
               loan_id uuid, loan_status text, borrower_id uuid, borrower_name text, due_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school uuid := app.current_school_id();
begin
  if v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not app.is_circulator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select c.id, b.id, b.title, c.copy_no, c.condition,
         ol.id, ol.status,
         case when app.has_role('librarian') or app.is_homeroom_of(ol.borrower_id) then ol.borrower_id end,
         case when app.has_role('librarian') or app.is_homeroom_of(ol.borrower_id)
              then bp.last_name || ' ' || bp.first_name end,
         ol.due_at
  from public.copy_codes cc
  join public.book_copies c on c.id = cc.copy_id
  join public.books b on b.id = c.book_id
  left join public.loans ol on ol.copy_id = c.id and ol.status in ('active', 'return_pending')
  left join public.profiles bp on bp.id = ol.borrower_id
  where cc.qr_code = p_qr and cc.school_id = v_school;
end $$;

-- ----------------------------------------------------------------------------
-- 16. Nusxalar, hisob faollashtirish
-- ----------------------------------------------------------------------------

create function public.add_book_copies(p_book_id uuid, p_count int)
returns table (copy_id uuid, copy_no int, qr_code text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school uuid := app.current_school_id();
  v_max    int;
begin
  if v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not app.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_count is null or p_count not between 1 and 100 then
    raise exception 'invalid_count';
  end if;
  perform 1 from public.books b where b.id = p_book_id and b.school_id = v_school for update;
  if not found then
    raise exception 'unknown_book';
  end if;

  select coalesce(max(c.copy_no), 0) into v_max from public.book_copies c where c.book_id = p_book_id;
  insert into public.book_copies (school_id, book_id, copy_no)
  select v_school, p_book_id, v_max + g from generate_series(1, p_count) g;

  perform app.audit(v_school, auth.uid(), 'copies_added', 'book', p_book_id,
    jsonb_build_object('count', p_count));

  return query
  select c.id, c.copy_no, cc.qr_code
  from public.book_copies c
  join public.copy_codes cc on cc.copy_id = c.id
  where c.book_id = p_book_id and c.copy_no > v_max
  order by c.copy_no;
end $$;

-- Xodim bir martalik kod beradi. Parolning o'zi hech kimga ko'rinmaydi.
-- Kutubxonachi/admin hisoblarini faqat admin tiklay oladi (huquqni oshirib yuborishning oldi).
create function public.issue_activation_code(p_profile_id uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_school uuid := app.current_school_id();
  v_code   text;
begin
  if auth.uid() is null or v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not app.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_profile_id and p.school_id = v_school) then
    raise exception 'unknown_profile';
  end if;
  if app.profile_is_privileged(p_profile_id) and not app.has_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.activation_codes where profile_id = p_profile_id and used_at is null;
  v_code := app.new_activation_code();
  insert into public.activation_codes (profile_id, code_hash, expires_at, created_by)
  values (p_profile_id, extensions.digest(p_profile_id::text || v_code, 'sha256'),
          now() + interval '14 days', auth.uid());

  perform app.audit(v_school, auth.uid(), 'activation_code_issued', 'profile', p_profile_id, '{}'::jsonb);
  return v_code;
end $$;

-- Faqat server (service_role): to'g'ri bo'lsa profil id, aks holda NULL.
-- Chaqiruvchi shundan keyin parolni Auth admin API orqali o'rnatadi.
create function public.redeem_activation_code(p_school_code text, p_login_id text, p_code text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile uuid;
  v_row     public.activation_codes;
begin
  select p.id into v_profile
  from public.profiles p
  join public.schools s on s.id = p.school_id
  where s.code = p_school_code and p.login_id = p_login_id and p.is_active;
  if not found then
    return null;
  end if;

  select * into v_row
  from public.activation_codes a
  where a.profile_id = v_profile and a.used_at is null and a.expires_at > now()
  order by a.created_at desc
  limit 1
  for update;
  if not found or v_row.failed_attempts >= 5 then
    return null;
  end if;

  if v_row.code_hash <> extensions.digest(v_profile::text || upper(btrim(p_code)), 'sha256') then
    update public.activation_codes set failed_attempts = failed_attempts + 1 where id = v_row.id;
    return null;
  end if;

  update public.activation_codes set used_at = now() where id = v_row.id;
  perform app.audit((select school_id from public.profiles where id = v_profile), v_profile,
                    'activation_code_redeemed', 'profile', v_profile, '{}'::jsonb);
  return v_profile;
end $$;

-- Karta yo'qolsa: QR kodni almashtirish.
create function public.rotate_profile_code(p_profile_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_school uuid := app.current_school_id();
begin
  if v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not app.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.profile_codes
  set public_code = app.new_code(), rotated_at = now()
  where profile_id = p_profile_id and school_id = v_school;
  if not found then
    raise exception 'unknown_profile';
  end if;
  perform app.audit(v_school, auth.uid(), 'profile_code_rotated', 'profile', p_profile_id, '{}'::jsonb);
end $$;

-- ----------------------------------------------------------------------------
-- 17. Test (viktorina): sessiya funksiyalari
-- ----------------------------------------------------------------------------

create function app.quiz_lock(p_attempt_id uuid) returns public.quiz_attempts
language plpgsql security definer set search_path = ''
as $$
declare
  v_a public.quiz_attempts;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_a from public.quiz_attempts
  where id = p_attempt_id and student_id = auth.uid()
  for update;
  if not found then
    raise exception 'attempt_not_found';
  end if;
  return v_a;
end $$;

create function app.quiz_state(p_a public.quiz_attempts) returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'attempt_id', p_a.id,
    'loan_id', p_a.loan_id,
    'status', p_a.status,
    'run_no', p_a.run_no,
    'exits', p_a.exits,
    'max_exits', p_a.max_exits,
    'exits_left', greatest(p_a.max_exits - p_a.exits, 0),
    'start_deadline', p_a.start_deadline,
    'questions_total', p_a.questions_total,
    'seconds_per_question', p_a.seconds_per_question,
    'result', case when p_a.status = 'completed'
      then jsonb_build_object('correct', p_a.correct_count, 'total', p_a.questions_total, 'score_bp', p_a.score_bp) end
  )
$$;

-- Joriy bosqichdagi barcha savollarga javob berilgan bo'lsa, urinishni yakunlaydi.
create function app.quiz_finish(p_attempt_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_a       public.quiz_attempts;
  v_correct int;
  v_score   int;
begin
  select * into v_a from public.quiz_attempts where id = p_attempt_id for update;
  if v_a.status <> 'in_progress' then
    return;
  end if;
  if exists (select 1 from public.quiz_attempt_items i
             where i.attempt_id = p_attempt_id and i.run_no = v_a.run_no and i.answered_at is null) then
    raise exception 'quiz_not_finished';
  end if;

  select count(*) filter (where i.is_correct) into v_correct
  from public.quiz_attempt_items i
  where i.attempt_id = p_attempt_id and i.run_no = v_a.run_no;

  v_score := (v_correct * 10000 + v_a.questions_total / 2) / v_a.questions_total;

  update public.quiz_attempts
  set status = 'completed', finished_at = now(), correct_count = v_correct, score_bp = v_score,
      last_activity_at = now()
  where id = p_attempt_id;

  -- Qaytarish allaqachon tasdiqlangan bo'lsa, marralar darhol qayta hisoblanadi.
  if exists (select 1 from public.loans l where l.id = v_a.loan_id and l.status = 'returned') then
    perform app.award_milestones(v_a.student_id);
  end if;
end $$;

-- Vaqti o'tgan (javobsiz) savollarni 0 deb belgilaydi; hammasi tugagan bo'lsa yakunlaydi.
create function app.quiz_settle(p_attempt_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_a public.quiz_attempts;
begin
  select * into v_a from public.quiz_attempts where id = p_attempt_id;
  if v_a.status <> 'in_progress' then
    return;
  end if;
  update public.quiz_attempt_items i
  set answered_at = now(), timed_out = true, is_correct = false
  where i.attempt_id = p_attempt_id and i.run_no = v_a.run_no
    and i.answered_at is null and i.served_at is not null and i.deadline_at < now();
  if not exists (select 1 from public.quiz_attempt_items i
                 where i.attempt_id = p_attempt_id and i.run_no = v_a.run_no and i.answered_at is null) then
    perform app.quiz_finish(p_attempt_id);
  end if;
end $$;

-- Yangi bosqich: avval ko'rilmagan savollar, keyin takrorlar. Variantlar aralashtiriladi.
create function app.quiz_start_run(p_attempt_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_a   public.quiz_attempts;
  v_run int;
  v_n   int;
begin
  update public.quiz_attempts
  set run_no = run_no + 1, status = 'in_progress', started_at = coalesce(started_at, now()),
      last_activity_at = now()
  where id = p_attempt_id
  returning * into v_a;
  v_run := v_a.run_no;

  insert into public.quiz_attempt_items (attempt_id, run_no, position, question_id, option_order)
  select p_attempt_id, v_run,
         (row_number() over (order by random()))::int,
         s.id,
         (select array_agg(o.id order by random()) from public.quiz_options o where o.question_id = s.id)
  from (
    select q.id,
           exists (select 1 from public.quiz_attempt_items i
                   where i.attempt_id = p_attempt_id and i.question_id = q.id) as seen
    from public.quiz_questions q
    where q.book_id = v_a.book_id and q.status = 'approved'
    order by seen, random()
    limit v_a.questions_total
  ) s;
  get diagnostics v_n = row_count;
  if v_n < v_a.questions_total then
    raise exception 'quiz_bank_too_small';
  end if;
end $$;

-- Chiqish hisobi: faqat joriy bosqich ('in_progress' va run_no mos) uchun, bir marta (idempotent).
create function app.quiz_register_exit(p_attempt_id uuid, p_run_no int) returns void
language sql security definer set search_path = ''
as $$
  update public.quiz_attempts a
  set exits = a.exits + 1,
      status = case when a.exits + 1 >= a.max_exits then 'cancelled_exits' else 'pending' end,
      finished_at = case when a.exits + 1 >= a.max_exits then now() end,
      last_activity_at = now()
  where a.id = p_attempt_id and a.status = 'in_progress' and a.run_no = p_run_no
$$;

-- O'quvchi uchun hozir boshlash/davom ettirish mumkin bo'lgan testlar.
create function public.my_quizzes()
returns table (attempt_id uuid, loan_id uuid, book_title text, status text, start_deadline timestamptz,
               questions_total int, seconds_per_question int, exits int, max_exits int)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return query
  select a.id, a.loan_id, b.title, a.status, a.start_deadline, a.questions_total,
         a.seconds_per_question, a.exits, a.max_exits
  from public.quiz_attempts a
  join public.books b on b.id = a.book_id
  where a.student_id = auth.uid()
    and ((a.status = 'pending' and a.start_deadline > now()) or a.status = 'in_progress')
  order by a.start_deadline;
end $$;

create function public.quiz_open(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_a public.quiz_attempts;
begin
  v_a := app.quiz_lock(p_attempt_id);
  if v_a.status = 'pending' and now() > v_a.start_deadline then
    update public.quiz_attempts set status = 'expired', finished_at = now()
    where id = p_attempt_id returning * into v_a;
  end if;
  return app.quiz_state(v_a);
end $$;

-- p_fresh_load = true: sahifa yangidan ochilgan (mijoz holati yo'q). Agar sessiya 'in_progress'
-- bo'lib kamida bitta savol ko'rsatilgan bo'lsa, bu ilovadan chiqish deb sanaladi.
create function public.quiz_start_or_resume(p_attempt_id uuid, p_fresh_load boolean default false) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_a public.quiz_attempts;
begin
  v_a := app.quiz_lock(p_attempt_id);

  if v_a.status = 'in_progress' then
    perform app.quiz_settle(p_attempt_id);
    select * into v_a from public.quiz_attempts where id = p_attempt_id;
    if v_a.status = 'in_progress' and p_fresh_load
       and exists (select 1 from public.quiz_attempt_items i
                   where i.attempt_id = p_attempt_id and i.run_no = v_a.run_no and i.served_at is not null) then
      perform app.quiz_register_exit(p_attempt_id, v_a.run_no);
      select * into v_a from public.quiz_attempts where id = p_attempt_id;
    end if;
  end if;

  if v_a.status = 'pending' then
    if now() > v_a.start_deadline then
      update public.quiz_attempts set status = 'expired', finished_at = now() where id = p_attempt_id;
    else
      perform app.quiz_start_run(p_attempt_id);
    end if;
    select * into v_a from public.quiz_attempts where id = p_attempt_id;
  end if;

  return app.quiz_state(v_a);
end $$;

create function public.quiz_report_exit(p_attempt_id uuid, p_run_no int) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_a public.quiz_attempts;
begin
  v_a := app.quiz_lock(p_attempt_id);
  perform app.quiz_register_exit(p_attempt_id, p_run_no);
  select * into v_a from public.quiz_attempts where id = p_attempt_id;
  return app.quiz_state(v_a);
end $$;

-- Faqat joriy savol beriladi. To'g'ri javob hech qachon qaytarilmaydi.
create function public.quiz_next_question(p_attempt_id uuid, p_run_no int) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_a    public.quiz_attempts;
  v_item public.quiz_attempt_items;
  v_body text;
  v_opts jsonb;
begin
  v_a := app.quiz_lock(p_attempt_id);
  if v_a.status <> 'in_progress' or v_a.run_no <> p_run_no then
    raise exception 'stale_run';
  end if;

  perform app.quiz_settle(p_attempt_id);
  select * into v_a from public.quiz_attempts where id = p_attempt_id;
  if v_a.status = 'completed' then
    return jsonb_build_object('finished', true) || jsonb_build_object('state', app.quiz_state(v_a));
  end if;

  select * into v_item
  from public.quiz_attempt_items i
  where i.attempt_id = p_attempt_id and i.run_no = v_a.run_no and i.answered_at is null
  order by i.position
  limit 1
  for update;
  if not found then
    raise exception 'no_open_question';
  end if;

  if v_item.served_at is null then
    update public.quiz_attempt_items i
    set served_at = now(),
        deadline_at = now() + make_interval(secs => v_a.seconds_per_question + v_a.grace_seconds)
    where i.attempt_id = v_item.attempt_id and i.run_no = v_item.run_no and i.position = v_item.position
    returning * into v_item;
  end if;
  update public.quiz_attempts set last_activity_at = now() where id = p_attempt_id;

  select q.body into v_body from public.quiz_questions q where q.id = v_item.question_id;
  select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body) order by u.ord)
  into v_opts
  from unnest(v_item.option_order) with ordinality as u(id, ord)
  join public.quiz_options o on o.id = u.id;

  return jsonb_build_object(
    'finished', false,
    'position', v_item.position,
    'total', v_a.questions_total,
    'question_id', v_item.question_id,
    'body', v_body,
    'options', v_opts,
    'seconds_left', least(v_a.seconds_per_question,
      greatest(0, ceil(extract(epoch from (v_item.deadline_at - now())) - v_a.grace_seconds))::int)
  );
end $$;

create function public.quiz_answer(p_attempt_id uuid, p_run_no int, p_question_id uuid, p_option_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_a         public.quiz_attempts;
  v_item      public.quiz_attempt_items;
  v_ok        boolean;
  v_timed_out boolean := false;
  v_finished  boolean := false;
begin
  v_a := app.quiz_lock(p_attempt_id);
  if v_a.status <> 'in_progress' or v_a.run_no <> p_run_no then
    raise exception 'stale_run';
  end if;

  select * into v_item
  from public.quiz_attempt_items i
  where i.attempt_id = p_attempt_id and i.run_no = v_a.run_no and i.answered_at is null
  order by i.position
  limit 1
  for update;
  if not found then
    raise exception 'no_open_question';
  end if;
  if v_item.question_id <> p_question_id or v_item.served_at is null then
    raise exception 'not_current_question';
  end if;

  if now() > v_item.deadline_at then
    v_timed_out := true;
    update public.quiz_attempt_items i
    set answered_at = now(), timed_out = true, is_correct = false
    where i.attempt_id = v_item.attempt_id and i.run_no = v_item.run_no and i.position = v_item.position;
  else
    if not (p_option_id = any (v_item.option_order)) then
      raise exception 'invalid_option';
    end if;
    select (k.correct_option_id = p_option_id) into v_ok
    from public.quiz_answer_keys k where k.question_id = v_item.question_id;
    update public.quiz_attempt_items i
    set answered_at = now(), chosen_option_id = p_option_id, is_correct = coalesce(v_ok, false)
    where i.attempt_id = v_item.attempt_id and i.run_no = v_item.run_no and i.position = v_item.position;
  end if;

  update public.quiz_attempts set last_activity_at = now() where id = p_attempt_id;

  if not exists (select 1 from public.quiz_attempt_items i
                 where i.attempt_id = p_attempt_id and i.run_no = v_a.run_no and i.answered_at is null) then
    perform app.quiz_finish(p_attempt_id);
    v_finished := true;
  end if;

  select * into v_a from public.quiz_attempts where id = p_attempt_id;
  return jsonb_build_object('accepted', not v_timed_out, 'timed_out', v_timed_out,
                            'finished', v_finished, 'state', app.quiz_state(v_a));
end $$;

-- Cron (har 5 daqiqada, service_role): muddati o'tgan urinishlarni yopadi.
create function public.quiz_expire_due() returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  with u as (
    update public.quiz_attempts a
    set status = 'expired', finished_at = now()
    where (a.status = 'pending' and a.start_deadline < now())
       or (a.status = 'in_progress' and a.start_deadline < now()
           and a.last_activity_at < now() - make_interval(secs => a.seconds_per_question + a.grace_seconds))
    returning 1
  )
  select count(*) into v_count from u;
  return v_count;
end $$;

-- ----------------------------------------------------------------------------
-- 18. Reyting, katalog, progress
-- ----------------------------------------------------------------------------

-- Shaxsiy reyting. Tenglikda: ball, keyin test o'rtachasi, keyin kitoblar soni.
-- Ommaviy ko'rinish: "Ism + familiya bosh harfi".
create function public.leaderboard(p_kind text default 'student', p_from timestamptz default null,
                                   p_to timestamptz default null, p_class_id uuid default null,
                                   p_limit int default 100)
returns table (place bigint, profile_id uuid, display_name text, class_name text, books int,
               tests int, avg_test_bp int, points int, is_me boolean)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school uuid := app.current_school_id();
begin
  if v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_kind not in ('student', 'teacher') then
    raise exception 'invalid_kind';
  end if;

  return query
  with agg as (
    select s.borrower_id,
           count(*)::int as books,
           count(s.score_bp)::int as tests,
           coalesce(round(avg(s.score_bp)), 0)::int as avg_bp,
           sum(s.points)::int as points
    from app.scored_loan_points s
    where s.school_id = v_school
      and (p_from is null or s.verified_at >= p_from)
      and (p_to is null or s.verified_at < p_to)
    group by s.borrower_id
  ),
  joined as (
    select g.borrower_id, g.books, g.tests, g.avg_bp, g.points,
           p.first_name, p.last_name, cl.cid, cl.cname
    from agg g
    join public.profiles p on p.id = g.borrower_id and p.kind = p_kind and p.is_active
    left join lateral (
      select c.id as cid, c.name as cname
      from public.enrollments e
      join public.classes c on c.id = e.class_id
      join public.academic_years y on y.id = c.academic_year_id and y.is_current
      where e.student_id = p.id
      limit 1
    ) cl on true
    where p_class_id is null or cl.cid = p_class_id
  ),
  ranked as (
    select j.*,
           rank() over (order by j.points desc, j.avg_bp desc, j.books desc) as place,
           row_number() over (order by j.points desc, j.avg_bp desc, j.books desc, j.borrower_id) as rn
    from joined j
  )
  select r.place, r.borrower_id,
         r.first_name || ' ' || upper(left(r.last_name, 1)) || '.',
         r.cname, r.books, r.tests, r.avg_bp, r.points,
         (r.borrower_id = auth.uid())
  from ranked r
  where r.rn <= greatest(p_limit, 1) or r.borrower_id = auth.uid()
  order by r.rn;
end $$;

-- Sinflar reytingi: sinf bali = sum(min(o'quvchi bali, cheklov)) / sinfdagi BARCHA o'quvchilar.
create function public.leaderboard_classes(p_from timestamptz default null, p_to timestamptz default null)
returns table (place bigint, class_id uuid, class_name text, students int, participants int,
               books int, class_score numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school uuid := app.current_school_id();
  v_cap    int;
begin
  if v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select s.class_points_cap into v_cap from public.school_settings s where s.school_id = v_school;

  return query
  with cur as (
    select c.id, c.name, count(e.student_id)::int as n
    from public.classes c
    join public.academic_years y on y.id = c.academic_year_id and y.is_current
    left join public.enrollments e on e.class_id = c.id
    where c.school_id = v_school
    group by c.id, c.name
    having count(e.student_id) > 0
  ),
  per_student as (
    select e.class_id, s.borrower_id, sum(s.points)::int as pts, count(*)::int as bks
    from public.enrollments e
    join app.scored_loan_points s on s.borrower_id = e.student_id
    where e.school_id = v_school
      and (p_from is null or s.verified_at >= p_from)
      and (p_to is null or s.verified_at < p_to)
    group by e.class_id, s.borrower_id
  ),
  agg as (
    select cur.id, cur.name, cur.n,
           count(ps.borrower_id) filter (where ps.pts > 0)::int as participants,
           coalesce(sum(ps.bks), 0)::int as bks,
           coalesce(sum(least(ps.pts, v_cap)), 0)::numeric / cur.n as score
    from cur
    left join per_student ps on ps.class_id = cur.id
    group by cur.id, cur.name, cur.n
  )
  select rank() over (order by a.score desc, a.participants desc), a.id, a.name, a.n,
         a.participants, a.bks, round(a.score, 2)
  from agg a
  order by 1, a.name;
end $$;

-- Kitoblar katalogi: nusxalar soni va nechtasi bo'sh (kim olganini o'quvchi ko'rmaydi).
create function public.catalog_overview()
returns table (book_id uuid, title text, author text, pages int, total_copies int, available_copies int)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school uuid := app.current_school_id();
begin
  if v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return query
  select b.id, b.title, b.author, b.pages,
         (count(c.id) filter (where c.condition = 'active'))::int,
         (count(c.id) filter (where c.condition = 'active' and o.copy_id is null))::int
  from public.books b
  left join public.book_copies c on c.book_id = b.id
  left join (
    select distinct l.copy_id from public.loans l
    where l.school_id = v_school and l.status in ('active', 'return_pending')
  ) o on o.copy_id = c.id
  where b.school_id = v_school
  group by b.id, b.title, b.author, b.pages
  order by b.title;
end $$;

create function public.coin_balance() returns int
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(c.amount), 0)::int from public.coin_ledger c where c.profile_id = auth.uid()
$$;

-- O'quvchining shaxsiy ko'rsatkichlari va keyingi marra (rag'batlantiruvchi xabarlar uchun).
create function public.my_progress()
returns table (books int, tests int, avg_test_bp int, points int, coin_balance int,
               next_milestone_books int, next_milestone_total int)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school uuid := app.current_school_id();
begin
  if v_school is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return query
  with me as (
    select count(*)::int as books,
           count(s.score_bp)::int as tests,
           coalesce(round(avg(s.score_bp)), 0)::int as avg_bp,
           coalesce(sum(s.points), 0)::int as points
    from app.scored_loan_points s
    where s.borrower_id = auth.uid()
  )
  select me.books, me.tests, me.avg_bp, me.points,
         (select coalesce(sum(c.amount), 0)::int from public.coin_ledger c where c.profile_id = auth.uid()),
         nm.books, nm.reward_total
  from me
  left join lateral (
    select m.books, m.reward_total
    from public.milestones m
    where m.school_id = v_school and m.books > me.tests
    order by m.books
    limit 1
  ) nm on true;
end $$;

-- ----------------------------------------------------------------------------
-- 19. Muddati o'tgan kitoblar haqida xabar (cron: kuniga 1 marta, service_role)
-- ----------------------------------------------------------------------------

create function public.enqueue_overdue_notices() returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  with due as (
    update public.loans l
    set last_overdue_notice_at = now()
    from public.school_settings s
    where s.school_id = l.school_id
      and l.status = 'active'
      and l.due_at < now()
      and (l.last_overdue_notice_at is null
           or l.last_overdue_notice_at < now() - make_interval(days => s.overdue_notice_every_days))
    returning l.id as loan_id, l.school_id, l.borrower_id, l.book_id, l.copy_id, l.borrowed_at, l.due_at
  ),
  info as (
    select d.loan_id, d.school_id, d.borrower_id,
           jsonb_build_object(
             'loan_id', d.loan_id,
             'borrower_id', d.borrower_id,
             'borrower_name', p.last_name || ' ' || p.first_name,
             'book_title', b.title,
             'days_since_borrowed', (now()::date - d.borrowed_at::date),
             'days_overdue', (now()::date - d.due_at::date)
           ) as payload
    from due d
    join public.profiles p on p.id = d.borrower_id
    join public.books b on b.id = d.book_id
  ),
  ins as (
    insert into public.notifications (school_id, recipient_id, kind, payload)
    select i.school_id, r.recipient_id, r.kind, i.payload
    from info i
    cross join lateral (
      select m.profile_id as recipient_id, 'overdue_staff'::text as kind
      from public.memberships m
      where m.school_id = i.school_id and m.role = 'librarian'
      union
      select i.borrower_id, 'overdue_self'::text
      union
      select c.homeroom_profile_id, 'overdue_staff'::text
      from public.enrollments e
      join public.classes c on c.id = e.class_id
      join public.academic_years y on y.id = c.academic_year_id and y.is_current
      where e.student_id = i.borrower_id and c.homeroom_profile_id is not null
    ) r
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end $$;

-- ----------------------------------------------------------------------------
-- 20. Row Level Security
-- ----------------------------------------------------------------------------

alter table public.schools            enable row level security;
alter table public.school_settings    enable row level security;
alter table public.profiles           enable row level security;
alter table public.profile_codes      enable row level security;
alter table public.activation_codes   enable row level security;
alter table public.memberships        enable row level security;
alter table public.academic_years     enable row level security;
alter table public.classes            enable row level security;
alter table public.enrollments        enable row level security;
alter table public.books              enable row level security;
alter table public.book_copies        enable row level security;
alter table public.copy_codes         enable row level security;
alter table public.loans              enable row level security;
alter table public.loan_requests      enable row level security;
alter table public.quiz_questions     enable row level security;
alter table public.quiz_options       enable row level security;
alter table public.quiz_answer_keys   enable row level security;
alter table public.quiz_attempts      enable row level security;
alter table public.quiz_attempt_items enable row level security;
alter table public.milestones         enable row level security;
alter table public.coin_ledger        enable row level security;
alter table public.notifications      enable row level security;
alter table public.audit_log          enable row level security;
-- activation_codes: siyosat yo'q => faqat service_role / funksiyalar.

-- Maktab va sozlamalar
create policy schools_select on public.schools for select to authenticated
  using (id = app.current_school_id());
create policy schools_update on public.schools for update to authenticated
  using (id = app.current_school_id() and app.has_role('admin'))
  with check (id = app.current_school_id() and app.has_role('admin'));

create policy settings_select on public.school_settings for select to authenticated
  using (school_id = app.current_school_id());
create policy settings_update on public.school_settings for update to authenticated
  using (school_id = app.current_school_id() and app.has_role('admin'))
  with check (school_id = app.current_school_id() and app.has_role('admin'));

-- Profillar: o'zi; kutubxonachi/admin; sinf rahbari o'z sinfi o'quvchilarini ko'radi.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (school_id = app.current_school_id()
        and (app.is_staff() or app.is_homeroom_of(id)))
  );
create policy profiles_update on public.profiles for update to authenticated
  using (
    school_id = app.current_school_id()
    and (app.has_role('admin') or (app.has_role('librarian') and not app.profile_is_privileged(id)))
  )
  with check (school_id = app.current_school_id());

create policy profile_codes_select on public.profile_codes for select to authenticated
  using (profile_id = (select auth.uid())
         or (school_id = app.current_school_id() and app.is_staff()));

create policy memberships_select on public.memberships for select to authenticated
  using (profile_id = (select auth.uid())
         or (school_id = app.current_school_id() and app.has_role('admin')));
create policy memberships_write on public.memberships for all to authenticated
  using (school_id = app.current_school_id() and app.has_role('admin'))
  with check (school_id = app.current_school_id() and app.has_role('admin'));

-- O'quv yili, sinflar
create policy years_select on public.academic_years for select to authenticated
  using (school_id = app.current_school_id());
create policy years_write on public.academic_years for all to authenticated
  using (school_id = app.current_school_id() and app.is_staff())
  with check (school_id = app.current_school_id() and app.is_staff());

create policy classes_select on public.classes for select to authenticated
  using (school_id = app.current_school_id());
create policy classes_write on public.classes for all to authenticated
  using (school_id = app.current_school_id() and app.is_staff())
  with check (school_id = app.current_school_id() and app.is_staff());

create policy enrollments_select on public.enrollments for select to authenticated
  using (student_id = (select auth.uid())
         or (school_id = app.current_school_id() and (app.is_staff() or app.is_homeroom_of(student_id))));
create policy enrollments_write on public.enrollments for all to authenticated
  using (school_id = app.current_school_id() and app.is_staff())
  with check (school_id = app.current_school_id() and app.is_staff());

-- Kitoblar, nusxalar
create policy books_select on public.books for select to authenticated
  using (school_id = app.current_school_id());
create policy books_write on public.books for all to authenticated
  using (school_id = app.current_school_id() and app.is_staff())
  with check (school_id = app.current_school_id() and app.is_staff());

create policy copies_select on public.book_copies for select to authenticated
  using (school_id = app.current_school_id());
create policy copies_write on public.book_copies for all to authenticated
  using (school_id = app.current_school_id() and app.is_staff())
  with check (school_id = app.current_school_id() and app.is_staff());

create policy copy_codes_select on public.copy_codes for select to authenticated
  using (school_id = app.current_school_id() and app.is_staff());

-- Qarzlar: o'zi; kutubxonachi/admin; sinf rahbari o'z sinfi o'quvchilariniki. Yozish faqat RPC orqali.
create policy loans_select on public.loans for select to authenticated
  using (
    borrower_id = (select auth.uid())
    or (school_id = app.current_school_id() and (app.is_staff() or app.is_homeroom_of(borrower_id)))
  );

create policy loan_requests_select on public.loan_requests for select to authenticated
  using (
    requester_id = (select auth.uid())
    or (school_id = app.current_school_id() and (app.is_staff() or app.is_homeroom_of(requester_id)))
  );

-- Test banki: faqat muharrirlar (kutubxonachi, admin, quiz_editor). O'quvchilar uchun siyosat YO'Q.
create policy quiz_questions_all on public.quiz_questions for all to authenticated
  using (school_id = app.current_school_id() and app.is_quiz_editor())
  with check (school_id = app.current_school_id() and app.is_quiz_editor());

create policy quiz_options_all on public.quiz_options for all to authenticated
  using (app.is_quiz_editor() and exists (
    select 1 from public.quiz_questions q
    where q.id = question_id and q.school_id = app.current_school_id()))
  with check (app.is_quiz_editor() and exists (
    select 1 from public.quiz_questions q
    where q.id = question_id and q.school_id = app.current_school_id()));

create policy quiz_keys_all on public.quiz_answer_keys for all to authenticated
  using (app.is_quiz_editor() and exists (
    select 1 from public.quiz_questions q
    where q.id = question_id and q.school_id = app.current_school_id()))
  with check (app.is_quiz_editor() and exists (
    select 1 from public.quiz_questions q
    where q.id = question_id and q.school_id = app.current_school_id()));

create policy quiz_attempts_select on public.quiz_attempts for select to authenticated
  using (student_id = (select auth.uid())
         or (school_id = app.current_school_id() and app.is_staff()));

create policy quiz_items_select on public.quiz_attempt_items for select to authenticated
  using (app.has_role('admin') and exists (
    select 1 from public.quiz_attempts a
    where a.id = attempt_id and a.school_id = app.current_school_id()));

-- Marralar, valyuta
create policy milestones_select on public.milestones for select to authenticated
  using (school_id = app.current_school_id());
create policy milestones_write on public.milestones for all to authenticated
  using (school_id = app.current_school_id() and app.has_role('admin'))
  with check (school_id = app.current_school_id() and app.has_role('admin'));

create policy ledger_select on public.coin_ledger for select to authenticated
  using (profile_id = (select auth.uid())
         or (school_id = app.current_school_id() and app.is_staff()));

create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy audit_select on public.audit_log for select to authenticated
  using (school_id = app.current_school_id() and app.has_role('admin'));

-- ----------------------------------------------------------------------------
-- 21. Huquqlar (grants) — "hammasini yopib, keraklisini ochish"
-- ----------------------------------------------------------------------------

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app') and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

grant select on
  public.schools, public.school_settings, public.profiles, public.profile_codes, public.memberships,
  public.academic_years, public.classes, public.enrollments, public.books, public.book_copies,
  public.copy_codes, public.loans, public.loan_requests, public.quiz_questions, public.quiz_options,
  public.quiz_answer_keys, public.quiz_attempts, public.quiz_attempt_items, public.milestones,
  public.coin_ledger, public.notifications, public.audit_log
to authenticated;

grant insert, update, delete on
  public.memberships, public.academic_years, public.classes, public.enrollments, public.books,
  public.book_copies, public.milestones, public.quiz_questions, public.quiz_options, public.quiz_answer_keys
to authenticated;

-- Ustun darajasidagi cheklovlar: kodni, rolni, maktabni mijoz o'zgartira olmaydi.
grant update (name, currency_name) on public.schools to authenticated;
grant update (loan_days, min_hold_days, min_pages, quiz_start_window_minutes, quiz_seconds_per_question,
              quiz_network_grace_seconds, quiz_questions_per_attempt, quiz_max_exits, base_points_per_book,
              quiz_points_max, class_points_cap, overdue_notice_every_days, updated_at)
  on public.school_settings to authenticated;
grant update (first_name, last_name, is_active) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- RLS siyosatlarida ishlatiladigan yordamchilar
grant usage on schema app to authenticated;
grant execute on function
  app.current_school_id(), app.has_role(text), app.is_staff(), app.is_quiz_editor(),
  app.is_homeroom_of(uuid), app.profile_is_privileged(uuid)
to authenticated;

-- Ochiq RPC'lar
grant execute on function
  public.issue_loan(uuid, uuid, uuid, timestamptz),
  public.record_return(uuid, text, timestamptz),
  public.verify_return(uuid, boolean, text),
  public.create_loan_request(text, text),
  public.decide_loan_request(uuid, boolean, uuid),
  public.find_profile_by_code(text),
  public.find_copy_by_qr(text),
  public.add_book_copies(uuid, int),
  public.issue_activation_code(uuid),
  public.rotate_profile_code(uuid),
  public.my_quizzes(),
  public.quiz_open(uuid),
  public.quiz_start_or_resume(uuid, boolean),
  public.quiz_report_exit(uuid, int),
  public.quiz_next_question(uuid, int),
  public.quiz_answer(uuid, int, uuid, uuid),
  public.leaderboard(text, timestamptz, timestamptz, uuid, int),
  public.leaderboard_classes(timestamptz, timestamptz),
  public.catalog_overview(),
  public.coin_balance(),
  public.my_progress()
to authenticated;

-- Faqat server / cron
grant execute on function
  public.redeem_activation_code(text, text, text),
  public.quiz_expire_due(),
  public.enqueue_overdue_notices()
to service_role;

commit;
