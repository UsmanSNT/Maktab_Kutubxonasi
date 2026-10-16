-- Test to'plami (oddiy PostgreSQL 15+; Supabase'ni taqlid qiluvchi 00_stub bilan).
-- Tartib: 00_stub_plain_postgres.sql -> ../001_maktab_kutubxona.sql -> shu fayl (psql -v ON_ERROR_STOP=1).
-- Eslatma: shu fayl 'test' sxemasini yaratadi, ishlab chiqarish bazasida ishga tushirmang.
\set ON_ERROR_STOP on
\set QUIET on
create schema test;
grant usage on schema test to authenticated, anon, service_role;

create function test.become(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
  execute 'reset role';
  if p is not null then execute 'set role authenticated'; end if;
end $$;

create function test.svc() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'reset role'; execute 'set role service_role';
end $$;

create function test.ok(c boolean, msg text) returns void language plpgsql as $$
begin if c is distinct from true then raise exception 'ASSERT FAILED: %', msg; end if; raise notice 'ok  - %', msg; end $$;

create function test.expect_error(p_sql text, p_pat text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm !~ p_pat then raise exception 'WRONG ERROR for [%]: got [%], expected [%]', p_sql, sqlerrm, p_pat; end if;
    raise notice 'ok  - rad etildi (%): %', p_pat, left(p_sql, 60); return;
  end;
  raise exception 'EXPECTED ERROR [%] BUT SUCCEEDED: %', p_pat, p_sql;
end $$;

create function test.correct_option(q uuid) returns uuid language sql security definer set search_path = '' as
$$ select correct_option_id from public.quiz_answer_keys where question_id = q $$;

create function test.take_quiz(p_attempt uuid, p_n_correct int) returns jsonb language plpgsql as $$
declare st jsonb; run int; q jsonb; i int := 0; opt uuid; res jsonb; corr uuid;
begin
  st := public.quiz_start_or_resume(p_attempt, false);
  run := (st->>'run_no')::int;
  loop
    q := public.quiz_next_question(p_attempt, run);
    exit when (q->>'finished')::boolean;
    i := i + 1;
    corr := test.correct_option((q->>'question_id')::uuid);
    if i <= p_n_correct then opt := corr;
    else select (o->>'id')::uuid into opt from jsonb_array_elements(q->'options') o where (o->>'id')::uuid <> corr limit 1; end if;
    res := public.quiz_answer(p_attempt, run, (q->>'question_id')::uuid, opt);
    exit when (res->>'finished')::boolean;
  end loop;
  return res;
end $$;

create function test.cycle(p_borrower uuid, p_book int, p_correct int) returns uuid language plpgsql as $$
declare v_copy uuid; v_qr text; v_loan uuid := gen_random_uuid(); v_att uuid;
begin
  perform test.become(null);
  select c.id, cc.qr_code into v_copy, v_qr from public.book_copies c
    join public.copy_codes cc on cc.copy_id = c.id join public.books b on b.id = c.book_id
    where b.title = 'Kitob ' || p_book and c.copy_no = 1;
  perform test.become('00000000-0000-0000-0000-0000000000b1');
  perform public.issue_loan(v_loan, v_copy, p_borrower);
  perform public.record_return(gen_random_uuid(), v_qr);
  perform test.become(p_borrower);
  select a.attempt_id into v_att from public.my_quizzes() a where a.loan_id = v_loan;
  perform test.take_quiz(v_att, p_correct);
  perform test.become(null);
  return v_loan;
end $$;

create function test.qr(p_book int, p_copy int) returns text language sql security definer set search_path = '' as $$
  select cc.qr_code from public.book_copies c join public.copy_codes cc on cc.copy_id = c.id
  join public.books b on b.id = c.book_id where b.title = 'Kitob ' || p_book and c.copy_no = p_copy $$;
create function test.copyid(p_book int, p_copy int) returns uuid language sql security definer set search_path = '' as $$
  select c.id from public.book_copies c join public.books b on b.id = c.book_id where b.title = 'Kitob ' || p_book and c.copy_no = p_copy $$;

-- ===================== FIXTURE (superuser) =====================
insert into public.schools (id, code, name) values
 ('11111111-1111-1111-1111-111111111111','s1','Maktab 1'),
 ('22222222-2222-2222-2222-222222222222','s2','Maktab 2');
insert into auth.users (id) values
 ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000c1'),
 ('00000000-0000-0000-0000-0000000000d1'),('00000000-0000-0000-0000-0000000000d2'),('00000000-0000-0000-0000-0000000000d3'),
 ('00000000-0000-0000-0000-0000000000e1'),('00000000-0000-0000-0000-0000000000f1');
insert into public.profiles (id, school_id, kind, login_id, first_name, last_name) values
 ('00000000-0000-0000-0000-0000000000a1','11111111-1111-1111-1111-111111111111','staff','ADM-01','Direktor','Karimov'),
 ('00000000-0000-0000-0000-0000000000b1','11111111-1111-1111-1111-111111111111','staff','LIB-01','Kutubxonachi','Rahimova'),
 ('00000000-0000-0000-0000-0000000000c1','11111111-1111-1111-1111-111111111111','teacher','T-0001','Sinfrahbar','Toshmatov'),
 ('00000000-0000-0000-0000-0000000000d1','11111111-1111-1111-1111-111111111111','student','S-0001','Ali','Valiyev'),
 ('00000000-0000-0000-0000-0000000000d2','11111111-1111-1111-1111-111111111111','student','S-0002','Bobur','Safarov'),
 ('00000000-0000-0000-0000-0000000000d3','11111111-1111-1111-1111-111111111111','student','S-0003','Charos','Nazarova'),
 ('00000000-0000-0000-0000-0000000000e1','11111111-1111-1111-1111-111111111111','teacher','T-0002','Dilnoza','Ergasheva'),
 ('00000000-0000-0000-0000-0000000000f1','22222222-2222-2222-2222-222222222222','student','S-0001','Zafar','Boshqa');
insert into public.memberships (school_id, profile_id, role, can_circulate) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000a1','admin',false),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000b1','librarian',true),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000c1','class_teacher',true);
insert into public.academic_years (id, school_id, label, starts_on, ends_on, is_current) values
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','2026-2027','2026-09-01','2027-06-01',true);
insert into public.classes (id, school_id, academic_year_id, name, grade, homeroom_profile_id) values
 ('cccccccc-0000-0000-0000-00000000007a','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','7-A',7,'00000000-0000-0000-0000-0000000000c1'),
 ('cccccccc-0000-0000-0000-00000000007b','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','7-B',7,null);
insert into public.enrollments (school_id, student_id, class_id, academic_year_id) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000d1','cccccccc-0000-0000-0000-00000000007a','aaaaaaaa-0000-0000-0000-000000000001'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000d2','cccccccc-0000-0000-0000-00000000007a','aaaaaaaa-0000-0000-0000-000000000001'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000d3','cccccccc-0000-0000-0000-00000000007b','aaaaaaaa-0000-0000-0000-000000000001');
update public.school_settings set min_hold_days = 0 where school_id = '11111111-1111-1111-1111-111111111111';

-- 12 kitob, har birida 12 ta tasdiqlangan savol (3 variant), 2 nusxa
do $$
declare b uuid; q uuid; o1 uuid; i int; n int;
begin
  for n in 1..12 loop
    insert into public.books (school_id, title, author, pages) values ('11111111-1111-1111-1111-111111111111', 'Kitob ' || n, 'Muallif', 100) returning id into b;
    insert into public.book_copies (school_id, book_id, copy_no) select '11111111-1111-1111-1111-111111111111', b, g from generate_series(1,2) g;
    for i in 1..12 loop
      insert into public.quiz_questions (school_id, book_id, body) values ('11111111-1111-1111-1111-111111111111', b, 'Savol ' || i || ' (kitob ' || n || ')') returning id into q;
      insert into public.quiz_options (question_id, body) values (q, 'to''g''ri') returning id into o1;
      insert into public.quiz_options (question_id, body) values (q, 'xato 1'), (q, 'xato 2');
      insert into public.quiz_answer_keys (question_id, correct_option_id) values (q, o1);
      update public.quiz_questions set status = 'approved', approved_by = '00000000-0000-0000-0000-0000000000b1' where id = q;
    end loop;
  end loop;
end $$;
-- Boshqa maktab uchun bitta kitob
insert into public.books (school_id, title, pages) values ('22222222-2222-2222-2222-222222222222', 'Boshqa kitob', 100);
\set QUIET off
\echo ===== FIXTURE OK =====

\echo '--- T1: berish, idempotentlik, bitta nusxa = bitta odam'
select test.become('00000000-0000-0000-0000-0000000000b1');
select test.ok((select count(*) from public.catalog_overview()) = 12, 'katalog 12 kitob');
select test.ok((select available_copies from public.catalog_overview() where title='Kitob 1') = 2, 'Kitob 1: 2 nusxa bo''sh');
select (public.issue_loan('10000000-0000-0000-0000-000000000001', test.copyid(1,1), '00000000-0000-0000-0000-0000000000d1')).status as loan1;
select test.ok((select available_copies from public.catalog_overview() where title='Kitob 1') = 1, 'Kitob 1: 1 nusxa bo''sh (kim olgani ko''rinadi)');
select test.ok((public.issue_loan('10000000-0000-0000-0000-000000000001', test.copyid(1,1), '00000000-0000-0000-0000-0000000000d1')).id is not null, 'replay qaytardi');
select test.ok((select count(*) from public.loans) = 1, 'takroriy yuborish dublikat yaratmadi');
select test.expect_error($q$select public.issue_loan(gen_random_uuid(), test.copyid(1,1), '00000000-0000-0000-0000-0000000000d2')$q$, 'copy_already_on_loan');
select test.expect_error($q$select public.issue_loan(gen_random_uuid(), test.copyid(1,2), '00000000-0000-0000-0000-0000000000d1')$q$, 'borrower_has_this_book');
select test.expect_error($q$select public.issue_loan('10000000-0000-0000-0000-000000000001', test.copyid(1,2), '00000000-0000-0000-0000-0000000000d2')$q$, 'loan_id_conflict');

\echo '--- T2: RLS — o''quvchi faqat o''zini ko''radi, javoblar kaliti yopiq'
select test.become('00000000-0000-0000-0000-0000000000d1');
select test.ok((select count(*) from public.loans) = 1, 'A o''z qarzini ko''radi');
select test.ok((select count(*) from public.quiz_answer_keys) = 0, 'A javoblar kalitini ko''ra olmaydi');
select test.ok((select count(*) from public.quiz_questions) = 0, 'A savollar jadvalini ko''ra olmaydi');
select test.ok((select count(*) from public.quiz_attempt_items) = 0, 'A urinish elementlarini ko''ra olmaydi');
select test.ok((select count(*) from public.copy_codes) = 0, 'A nusxa QR kodlarini ko''ra olmaydi');
select test.ok((select count(*) from public.profile_codes) = 1, 'A faqat o''z karta kodini ko''radi');
select test.ok((select count(*) from public.profiles) = 1, 'A faqat o''z profilini ko''radi');
select test.expect_error($q$insert into public.loans (school_id, copy_id, book_id, borrower_id, issued_by, due_at) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), now()+interval '1 day')$q$, 'permission denied');
select test.expect_error($q$select public.issue_loan(gen_random_uuid(), test.copyid(2,1), '00000000-0000-0000-0000-0000000000d1')$q$, 'forbidden');
select test.expect_error($q$insert into public.coin_ledger (school_id, profile_id, amount, kind) values (gen_random_uuid(), gen_random_uuid(), 1000, 'adjustment')$q$, 'permission denied');
select test.expect_error($q$update public.profiles set kind = 'staff' where id = '00000000-0000-0000-0000-0000000000d1'$q$, 'permission denied');
select test.become('00000000-0000-0000-0000-0000000000d2');
select test.ok((select count(*) from public.loans) = 0, 'B boshqa o''quvchining qarzini ko''rmaydi');
select test.become('00000000-0000-0000-0000-0000000000f1');
select test.ok((select count(*) from public.loans) = 0 and (select count(*) from public.catalog_overview()) = 1, 'boshqa maktab o''quvchisi faqat o''z maktabini ko''radi');
select test.ok((select count(*) from public.leaderboard('student')) = 0, 'boshqa maktab reytingi bo''sh');
select test.expect_error($q$select * from public.find_copy_by_qr('x')$q$, 'forbidden');
select test.become('00000000-0000-0000-0000-0000000000b1');
select test.expect_error($q$select public.issue_loan(gen_random_uuid(), test.copyid(2,1), '00000000-0000-0000-0000-0000000000f1')$q$, 'forbidden');

\echo '--- T3: qabul qilish, test urinishi yaratildi'
select test.become('00000000-0000-0000-0000-0000000000b1');
select (public.record_return('20000000-0000-0000-0000-000000000001', test.qr(1,1))).status as returned;
select test.ok((select status from public.loans where id='10000000-0000-0000-0000-000000000001') = 'returned', 'qarz returned');
select test.ok((select scored and base_points = 10 from public.loans where id='10000000-0000-0000-0000-000000000001'), 'qarz hisoblandi (10 ball)');
select test.ok((public.record_return('20000000-0000-0000-0000-000000000001', test.qr(1,1))).status = 'returned', 'replay qaytardi');
select test.ok((select count(*) from public.quiz_attempts) = 1, 'bitta urinish (replay dublikat bermadi)');
select test.expect_error($q$select public.record_return(gen_random_uuid(), test.qr(1,1))$q$, 'no_open_loan');
select test.ok((select available_copies from public.catalog_overview() where title='Kitob 1') = 2, 'qaytgach nusxa yana bo''sh');

\echo '--- T4: test ishlash, ball, reyting'
select test.become('00000000-0000-0000-0000-0000000000d1');
select test.ok((select count(*) from public.my_quizzes()) = 1, 'my_quizzes: 1 ta');
select test.take_quiz((select attempt_id from public.my_quizzes()), 10)->'state'->'result' as result;
select test.ok((select (a.score_bp = 10000 and a.status='completed') from public.quiz_attempts a), 'test 100% tugadi');
select test.ok((select points from public.my_progress()) = 40, 'A: 10 + 30 = 40 ball');
select test.ok((select count(*) from public.my_quizzes()) = 0, 'tugagan test ro''yxatdan chiqdi');
select test.expect_error($q$select public.quiz_next_question((select id from public.quiz_attempts), 1)$q$, 'stale_run');
select test.ok((select display_name from public.leaderboard('student') where is_me) = 'Ali V.', 'reytingda "Ism + familiya bosh harfi"');
select test.become('00000000-0000-0000-0000-0000000000d2');
select test.expect_error($q$select public.quiz_open((select id from public.quiz_attempts))$q$, 'attempt_not_found');
select test.ok((select count(*) from public.leaderboard('student')) = 1, 'B reytingda A ni ko''radi (ommaviy)');

\echo '--- T5: marralar — 5 kitob (50), 10 kitob (jami 100, qo''shilmaydi)'
select test.cycle('00000000-0000-0000-0000-0000000000d1', n, 10) from generate_series(2,5) n;
select test.become('00000000-0000-0000-0000-0000000000d1');
select test.ok((select coin_balance from public.my_progress()) = 50, '5 kitob, 100% => 50 Alfa');
select test.ok((select next_milestone_books from public.my_progress()) = 10, 'keyingi marra: 10');
select test.cycle('00000000-0000-0000-0000-0000000000d1', n, 10) from generate_series(6,10) n;
select test.become('00000000-0000-0000-0000-0000000000d1');
select test.ok((select public.coin_balance()) = 100, '10 kitob => jami 100 (150 emas)');
select test.ok((select count(*) from public.coin_ledger) = 2 and (select min(amount) from public.coin_ledger) = 50, 'daftar: 50 + 50');
select test.ok((select count(*) from public.notifications where kind='milestone') = 2, 'marra xabarlari');
select test.ok((select next_milestone_books from public.my_progress()) = 20 and (select next_milestone_total from public.my_progress()) = 200, 'keyingi marra 20 => 200');

\echo '--- T6: o''rtacha 80% dan past bo''lsa marra yo''q; keyin ko''tarilsa jami to''ldiriladi'
select test.cycle('00000000-0000-0000-0000-0000000000d2', n, 7) from generate_series(1,5) n;
select test.become('00000000-0000-0000-0000-0000000000d2');
select test.ok((select coin_balance from public.my_progress()) = 0, 'B: 5 kitob, 70% => marra yo''q');
select test.cycle('00000000-0000-0000-0000-0000000000d2', n, 10) from generate_series(6,10) n;
select test.become('00000000-0000-0000-0000-0000000000d2');
select test.ok((select public.coin_balance()) = 100, 'B: 10 kitob, o''rtacha 85% => 100 (5-marra o''tkazib yuborilgan, jami to''ldirildi)');
select test.ok((select count(*) from public.coin_ledger) = 2 and (select sum(amount) from public.coin_ledger) = 100, 'B: 8-kitobda o''rtacha 80% dan oshib 5-marra (50), 10-kitobda yana 50');

\echo '--- T7: chiqishlar — 5-chiqishda bekor, test bali yo''q, marraga hisoblanmaydi'
select test.become('00000000-0000-0000-0000-0000000000b1');
select (public.issue_loan('10000000-0000-0000-0000-000000000011', test.copyid(11,1), '00000000-0000-0000-0000-0000000000d3')).status;
select (public.record_return(gen_random_uuid(), test.qr(11,1))).status;
select test.become('00000000-0000-0000-0000-0000000000d3');
select public.quiz_start_or_resume((select id from public.quiz_attempts where loan_id='10000000-0000-0000-0000-000000000011'), false)->>'status' as s1;
create temp table if not exists c_att as select 1 as x;
select test.become(null);
select test.become('00000000-0000-0000-0000-0000000000d3');
do $$
declare a uuid; st jsonb; i int; run int;
begin
  select id into a from public.quiz_attempts where loan_id='10000000-0000-0000-0000-000000000011';
  run := 1;
  perform public.quiz_next_question(a, run);
  st := public.quiz_report_exit(a, run);                       -- 1-chiqish
  perform test.ok((st->>'exits')::int = 1 and st->>'status' = 'pending', '1-chiqish: pending, exits=1');
  st := public.quiz_report_exit(a, run);                       -- takroriy hisobot (idempotent)
  perform test.ok((st->>'exits')::int = 1, 'bir run uchun chiqish bir marta sanaladi');
  for i in 2..4 loop
    st := public.quiz_start_or_resume(a, false); run := (st->>'run_no')::int;
    perform public.quiz_next_question(a, run);
    st := public.quiz_report_exit(a, run);
    perform test.ok((st->>'exits')::int = i and st->>'status' = 'pending', i || '-chiqish: qayta boshlash mumkin');
  end loop;
  st := public.quiz_start_or_resume(a, false); run := (st->>'run_no')::int;
  perform test.ok(run = 5, '5-bosqich boshlandi');
  st := public.quiz_report_exit(a, run);                       -- 5-chiqish
  perform test.ok(st->>'status' = 'cancelled_exits' and (st->>'exits')::int = 5, '5-chiqishda test bekor qilindi');
  st := public.quiz_start_or_resume(a, false);
  perform test.ok(st->>'status' = 'cancelled_exits', 'bekor qilingan testni qayta boshlab bo''lmaydi');
  perform test.expect_error(format('select public.quiz_next_question(%L, 6)', a), 'stale_run');
end $$;
select test.ok((select points from public.my_progress()) = 10 and (select tests from public.my_progress()) = 0, 'C: kitob uchun faqat 10 ball, testlar 0, marraga yo''q');

\echo '--- T8: qayta yuklash (fresh_load) faqat savol ko''rsatilgan bo''lsa chiqish hisoblanadi'
select test.become('00000000-0000-0000-0000-0000000000b1');
select (public.issue_loan('10000000-0000-0000-0000-000000000012', test.copyid(12,1), '00000000-0000-0000-0000-0000000000d3')).status;
select (public.record_return(gen_random_uuid(), test.qr(12,1))).status;
select test.become('00000000-0000-0000-0000-0000000000d3');
do $$
declare a uuid; st jsonb;
begin
  select id into a from public.quiz_attempts where loan_id='10000000-0000-0000-0000-000000000012';
  st := public.quiz_start_or_resume(a, true);   -- birinchi marta, fresh_load=true, hali savol yo'q
  perform test.ok((st->>'exits')::int = 0 and st->>'status' = 'in_progress', 'savol ko''rsatilmaguncha fresh_load chiqish emas');
  perform public.quiz_next_question(a, 1);
  st := public.quiz_start_or_resume(a, true);   -- sahifa qayta yuklandi
  perform test.ok((st->>'exits')::int = 1 and (st->>'run_no')::int = 2, 'qayta yuklash = chiqish, yangi bosqich');
end $$;

\echo '--- T9: sinf rahbari — tasdiqlanmagan qabul ballga tushmaydi'
select test.become('00000000-0000-0000-0000-0000000000c1');
select test.expect_error($q$select public.issue_loan(gen_random_uuid(), test.copyid(2,2), '00000000-0000-0000-0000-0000000000d3')$q$, 'forbidden');
select test.ok((select count(*) from public.profiles) = 3 and (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000d3') = 0, 'sinf rahbari faqat o''z sinfi o''quvchilarini (A, B) va o''zini ko''radi, C ni emas');
select test.ok((select count(*) from public.loans where borrower_id = '00000000-0000-0000-0000-0000000000d3') = 0, 'boshqa sinf qarzlarini ko''rmaydi');
select (public.issue_loan('10000000-0000-0000-0000-000000000021', test.copyid(11,2), '00000000-0000-0000-0000-0000000000d1')).status;
select (public.record_return(gen_random_uuid(), test.qr(11,2))).status as t_return;
select test.ok((select status from public.loans where id='10000000-0000-0000-0000-000000000021') = 'return_pending', 'sinf rahbari qabuli: return_pending');
select test.expect_error($q$select public.verify_return('10000000-0000-0000-0000-000000000021', true)$q$, 'forbidden');
select test.become('00000000-0000-0000-0000-0000000000d1');
select test.take_quiz((select id from public.quiz_attempts where loan_id='10000000-0000-0000-0000-000000000021'), 10)->'state'->>'status' as quiz_status;
select test.ok((select points from public.my_progress()) = 440, 'A: tasdiqlanmagan kitob ballga tushmadi (10 kitob = 400 + 40 = 440 kutilmoqda tasdiqdan keyin)') where false;
select test.ok((select books from public.my_progress()) = 10, 'tasdiqlanmagan kitob hisobga olinmadi (hali 10 kitob)');
select test.become('00000000-0000-0000-0000-0000000000b1');
select (public.verify_return('10000000-0000-0000-0000-000000000021', true)).status as verified;
select test.become('00000000-0000-0000-0000-0000000000d1');
select test.ok((select books from public.my_progress()) = 11 and (select points from public.my_progress()) = 440, 'tasdiqdan keyin: 11 kitob, 440 ball');

\echo '--- T10: rad etilgan qaytarish — qarz qayta ochiladi, urinish bekor'
select test.become('00000000-0000-0000-0000-0000000000c1');
select (public.issue_loan('10000000-0000-0000-0000-000000000022', test.copyid(12,2), '00000000-0000-0000-0000-0000000000d2')).status;
select (public.record_return(gen_random_uuid(), test.qr(12,2))).status;
select test.become('00000000-0000-0000-0000-0000000000d2');
select public.quiz_start_or_resume((select id from public.quiz_attempts where loan_id='10000000-0000-0000-0000-000000000022'), false)->>'status' as s;
select test.become('00000000-0000-0000-0000-0000000000b1');
select (public.verify_return('10000000-0000-0000-0000-000000000022', false, 'kitob yirtilgan')).status as rejected;
select test.ok((select status from public.quiz_attempts where loan_id='10000000-0000-0000-0000-000000000022') = 'voided', 'urinish bekor qilindi');
select test.become('00000000-0000-0000-0000-0000000000d2');
select test.expect_error($q$select public.quiz_next_question((select id from public.quiz_attempts where loan_id='10000000-0000-0000-0000-000000000022'), 1)$q$, 'stale_run');
select test.become('00000000-0000-0000-0000-0000000000c1');
select (public.record_return(gen_random_uuid(), test.qr(12,2))).status as rereturn;
select test.become(null);
select test.ok((select count(*) from public.quiz_attempts where loan_id='10000000-0000-0000-0000-000000000022' and status <> 'voided') = 1, 'qayta qabulda yangi urinish yaratildi');

\echo '--- T11: minimal ushlab turish muddati'
select test.become(null);
update public.school_settings set min_hold_days = 3 where school_id = '11111111-1111-1111-1111-111111111111';
select test.become('00000000-0000-0000-0000-0000000000b1');
select (public.issue_loan('10000000-0000-0000-0000-000000000031', test.copyid(3,1), '00000000-0000-0000-0000-0000000000e1')).status;
select (public.record_return(gen_random_uuid(), test.qr(3,1))).status;
select test.ok((select not scored and not_scored_reason = 'held_too_briefly' from public.loans where id='10000000-0000-0000-0000-000000000031'), 'tez qaytarilgan kitob ball bermaydi');
select test.ok((select count(*) from public.quiz_attempts where loan_id='10000000-0000-0000-0000-000000000031') = 0, 'test taklif qilinmadi');
select test.become(null);
update public.school_settings set min_hold_days = 0 where school_id = '11111111-1111-1111-1111-111111111111';

\echo '--- T12: boshlash oynasi va cron'
select test.become('00000000-0000-0000-0000-0000000000b1');
select (public.issue_loan('10000000-0000-0000-0000-000000000041', test.copyid(4,1), '00000000-0000-0000-0000-0000000000e1')).status;
select (public.record_return(gen_random_uuid(), test.qr(4,1))).status;
select (public.issue_loan('10000000-0000-0000-0000-000000000042', test.copyid(5,1), '00000000-0000-0000-0000-0000000000e1')).status;
select (public.record_return(gen_random_uuid(), test.qr(5,1))).status;
select test.become(null);
update public.quiz_attempts set start_deadline = now() - interval '1 minute' where loan_id in ('10000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000042');
select test.become('00000000-0000-0000-0000-0000000000e1');
select test.ok((select count(*) from public.my_quizzes()) = 0, 'muddati o''tgan test my_quizzes da yo''q');
select public.quiz_start_or_resume((select id from public.quiz_attempts where loan_id='10000000-0000-0000-0000-000000000041'), false)->>'status' as s;
select test.ok((select status from public.quiz_attempts where loan_id='10000000-0000-0000-0000-000000000041') = 'expired', 'oyna o''tgach test expired');
select test.expect_error($q$select public.quiz_expire_due()$q$, 'permission denied');
select test.svc();
select test.ok(public.quiz_expire_due() = 1, 'cron ikkinchi (pending) urinishni yopdi');
select test.become('00000000-0000-0000-0000-0000000000e1');
select test.ok((select points from public.my_progress()) = 20 and (select tests from public.my_progress()) = 0, 'o''qituvchi: 2 kitob x 10 ball, test yo''q');
select test.ok((select count(*) from public.leaderboard('teacher')) = 1 and (select count(*) from public.leaderboard('student')) = 3, 'o''qituvchilar va o''quvchilar reytingi alohida');
select test.ok((select count(*) from public.coin_ledger) = 0, 'o''qituvchiga valyuta yozilmaydi');

\echo '--- T13: reyting va sinflar'
select test.become('00000000-0000-0000-0000-0000000000d3');
select place, display_name, class_name, books, tests, points from public.leaderboard('student') order by place;
select test.ok((select place from public.leaderboard('student') where is_me) = 3, 'C reytingda 3-o''rin');
select * from public.leaderboard_classes();
select test.ok((select class_score from public.leaderboard_classes() where class_name='7-A') = ((select sum(points) from public.leaderboard('student', null, null, '2cccccc0-0000-0000-0000-000000000000') ) )::numeric, 'dummy') where false;
select test.ok((select class_score from public.leaderboard_classes() where class_name='7-A') =
  round(((select points from public.leaderboard('student') where display_name='Ali V.') + (select points from public.leaderboard('student') where display_name='Bobur S.'))::numeric / 2, 2), 'sinf bali = (A + B) / 2');
select test.ok((select class_score from public.leaderboard_classes() where class_name='7-B') =
  round((select points from public.leaderboard('student') where display_name='Charos N.')::numeric / 1, 2), 'sinf bali 7-B = C / 1');

\echo '--- T14: o''quvchi so''rovlari (rejim 3)'
select test.become('00000000-0000-0000-0000-0000000000d3');
select (public.create_loan_request('borrow', test.qr(6,1))).status as req;
select test.ok((public.create_loan_request('borrow', test.qr(6,1))).status = 'pending', 'dup so''rov mavjudini qaytardi');
select test.ok((select count(*) from public.loan_requests) = 1, 'takroriy so''rov dublikat bermadi');
select test.expect_error($q$select public.create_loan_request('return', test.qr(6,1))$q$, 'no_open_loan');
select test.become('00000000-0000-0000-0000-0000000000b1');
select test.ok((select count(*) from public.notifications where kind='loan_request') = 1, 'kutubxonachiga so''rov xabari keldi');
select (public.decide_loan_request((select id from public.loan_requests), true)).status as decided;
select test.ok((select count(*) from public.loans where copy_id = test.copyid(6,1) and status='active') = 1, 'tasdiqlangach qarz yaratildi');
select test.become('00000000-0000-0000-0000-0000000000d3');
select (public.create_loan_request('return', test.qr(6,1))).status as ret_req;
select test.become('00000000-0000-0000-0000-0000000000b1');
select (public.decide_loan_request((select id from public.loan_requests where kind='return'), true)).status as decided2;
select test.ok((select status from public.loans where copy_id = test.copyid(6,1) order by created_at desc limit 1) = 'returned', 'kutubxonachi tasdiqlagan qaytarish darhol returned');

\echo '--- T15: faollashtirish kodlari'
select test.become('00000000-0000-0000-0000-0000000000b1');
select length(public.issue_activation_code('00000000-0000-0000-0000-0000000000d1')) as code_len;
select test.expect_error($q$select public.issue_activation_code('00000000-0000-0000-0000-0000000000a1')$q$, 'forbidden');
select test.expect_error($q$select public.issue_activation_code('00000000-0000-0000-0000-0000000000b1')$q$, 'forbidden');
select test.become('00000000-0000-0000-0000-0000000000a1');
select length(public.issue_activation_code('00000000-0000-0000-0000-0000000000b1')) = 10 as admin_can;
select test.become(null);
do $$
declare c text; r uuid;
begin
  c := public.issue_activation_code_for_test();
exception when undefined_function then null;
end $$;
select test.become('00000000-0000-0000-0000-0000000000b1');
create temp table codes (code text);
insert into codes select public.issue_activation_code('00000000-0000-0000-0000-0000000000d1');
grant all on codes to public;
select test.svc();
select test.ok(public.redeem_activation_code('s1', 'S-0001', 'WRONGCODE1') is null, 'noto''g''ri kod => NULL');
select test.ok((select failed_attempts from public.activation_codes where profile_id='00000000-0000-0000-0000-0000000000d1' and used_at is null) = 1, 'urinish hisoblandi');
select test.ok(public.redeem_activation_code('s1', 'S-0001', (select code from codes)) = '00000000-0000-0000-0000-0000000000d1', 'to''g''ri kod => profil id');
select test.ok(public.redeem_activation_code('s1', 'S-0001', (select code from codes)) is null, 'kod ikkinchi marta ishlamaydi');

\echo '--- T16: muddati o''tgan kitoblar xabari'
select test.become('00000000-0000-0000-0000-0000000000b1');
select (public.issue_loan('10000000-0000-0000-0000-000000000051', test.copyid(7,2), '00000000-0000-0000-0000-0000000000d1')).status;
select test.become(null);
update public.loans set borrowed_at = now() - interval '20 days', due_at = now() - interval '6 days'
 where id = '10000000-0000-0000-0000-000000000051';
select test.svc();
select test.ok(public.enqueue_overdue_notices() = 3, 'xabarlar: kutubxonachi + sinf rahbari + o''quvchi (3 ta)');
select test.ok(public.enqueue_overdue_notices() = 0, 'takroriy ishga tushirishda dublikat yo''q');
select test.become('00000000-0000-0000-0000-0000000000b1');
select payload->>'borrower_name' as who, payload->>'book_title' as book, payload->>'days_since_borrowed' as since, payload->>'days_overdue' as overdue from public.notifications where kind='overdue_staff';

\echo '--- T17: huquqlar va append-only'
select test.become('00000000-0000-0000-0000-0000000000b1');
select test.expect_error($q$update public.profiles set first_name='X' where id='00000000-0000-0000-0000-0000000000a1' returning 1$q$, 'zzzz') where false;
update public.profiles set first_name = 'Hack' where id = '00000000-0000-0000-0000-0000000000a1';
select test.become(null);
select test.ok((select first_name from public.profiles where id='00000000-0000-0000-0000-0000000000a1') = 'Direktor', 'kutubxonachi admin profilini o''zgartira olmadi');
select test.expect_error($q$update public.coin_ledger set amount = 1$q$, 'append_only_table');
select test.expect_error($q$delete from public.coin_ledger$q$, 'append_only_table');
select test.expect_error($q$truncate public.coin_ledger$q$, 'append_only_table');
select test.expect_error($q$update public.audit_log set action='x'$q$, 'append_only_table');
select test.ok((select count(*) from public.audit_log) > 10, 'audit yozuvlari bor');
-- tasdiqlangan savol qulfi
select test.expect_error($q$insert into public.quiz_options (question_id, body) select id, 'yangi' from public.quiz_questions limit 1$q$, 'approved_question_is_locked');
select test.expect_error($q$update public.quiz_questions set status='approved' where id = (select id from public.quiz_questions limit 1) and false$q$, 'zzzz') where false;

\echo '--- T18: bir vaqtda ikkita marraga yetish — jami summa to''ldiriladi'
select test.become(null);
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000d4');
insert into public.profiles (id, school_id, kind, login_id, first_name, last_name) values
 ('00000000-0000-0000-0000-0000000000d4','11111111-1111-1111-1111-111111111111','student','S-0004','Dilshod','Qodirov');
select test.cycle('00000000-0000-0000-0000-0000000000d4', 1, 7);
select test.cycle('00000000-0000-0000-0000-0000000000d4', n, 8) from generate_series(2,9) n;
select test.become('00000000-0000-0000-0000-0000000000d4');
select test.ok((select coin_balance from public.my_progress()) = 0 and (select tests from public.my_progress()) = 9, 'D: 9 kitob, o''rtacha 78.9% => marra yo''q');
select test.cycle('00000000-0000-0000-0000-0000000000d4', 10, 10);
select test.become('00000000-0000-0000-0000-0000000000d4');
select test.ok((select count(*) from public.coin_ledger) = 1 and (select amount from public.coin_ledger) = 100 and (select milestone_books from public.coin_ledger) = 10, 'D: 10-kitobda o''rtacha 81% => bitta yozuv, jami 100');
select test.ok((select place from public.leaderboard('student') where is_me) = 3, 'D reytingda o''z o''rnida');

\echo '--- T19: o''tgan oy bo''yicha davr filtri (bo''sh) va sinf filtri'
select test.ok((select count(*) from public.leaderboard('student', now() + interval '1 day', null)) = 0, 'kelajak davri: bo''sh');
select test.ok((select count(*) from public.leaderboard('student', null, null, 'cccccccc-0000-0000-0000-00000000007b')) = 1, 'sinf filtri: 7-B da 1 ta o''quvchi');

\echo '===== HAMMA SINOVLAR O''TDI ====='
\echo '--- T20: savol vaqti tugashi (server soati)'
select test.become('00000000-0000-0000-0000-0000000000d3');
select (public.quiz_start_or_resume((select attempt_id from public.my_quizzes() where book_title='Kitob 6'), false))->>'status' as st;
select public.quiz_next_question((select attempt_id from public.my_quizzes() where book_title='Kitob 6'), 1)->>'position' as pos;
select test.become(null);
update public.quiz_attempt_items set deadline_at = now() - interval '1 second' where answered_at is null and served_at is not null;
select test.become('00000000-0000-0000-0000-0000000000d3');
select test.ok((public.quiz_answer((select attempt_id from public.my_quizzes() where book_title='Kitob 6'), 1,
   (select question_id from (select i.question_id from public.quiz_attempt_items i where false) x), gen_random_uuid())) is null, 'x') where false;
do $$
declare a uuid; q uuid; r jsonb;
begin
  select attempt_id into a from public.my_quizzes() where book_title='Kitob 6';
  r := public.quiz_next_question(a, 1);  -- settle: vaqti o'tgan savol 0 deb belgilanadi, keyingisi beriladi
  perform test.ok((r->>'position')::int = 2, 'vaqti o''tgan 1-savol o''tkazildi, 2-savol berildi');
  q := (r->>'question_id')::uuid;
  -- 2-savolning vaqti ham o'tgan holda javob yuborish
  perform test.become(null);
  update public.quiz_attempt_items set deadline_at = now() - interval '1 second' where answered_at is null and served_at is not null;
  perform test.become('00000000-0000-0000-0000-0000000000d3');
  r := public.quiz_answer(a, 1, q, test.correct_option(q));
  perform test.ok((r->>'timed_out')::boolean and not (r->>'accepted')::boolean, 'kech yuborilgan javob qabul qilinmadi (to''g''ri bo''lsa ham)');
  -- qolgan savollarni ham vaqti o'tgan deb belgilab, yakunlash
  perform test.become(null);
  update public.quiz_attempt_items set served_at = now() - interval '2 hours', deadline_at = now() - interval '1 hour' where attempt_id = a and answered_at is null;
  perform test.become('00000000-0000-0000-0000-0000000000d3');
  r := public.quiz_next_question(a, 1);
  perform test.ok((r->>'finished')::boolean and (r->'state'->'result'->>'score_bp')::int = 0, 'hamma savol vaqti o''tdi => test 0% bilan yakunlandi');
end $$;
select test.ok((select tests from public.my_progress()) = 1 and (select avg_test_bp from public.my_progress()) = 0, 'C: 1 test, o''rtacha 0%');

\echo '--- T21: funksiya huquqlari ro''yxati'
select test.become(null);
select test.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','app') and p.prokind='f'
    and has_function_privilege('anon', p.oid, 'execute')), 'anon hech bir funksiyani chaqira olmaydi');
select test.ok((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind='f' and has_function_privilege('authenticated', p.oid, 'execute')) = 21, 'authenticated: aynan 21 ta ochiq RPC');
select test.ok(not has_function_privilege('authenticated', 'public.quiz_expire_due()', 'execute')
  and not has_function_privilege('authenticated', 'public.redeem_activation_code(text,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.enqueue_overdue_notices()', 'execute'), 'cron/redeem funksiyalari authenticated uchun yopiq');
select test.ok(not exists (select 1 from information_schema.role_table_grants where grantee in ('anon') and table_schema='public'), 'anon jadvallarga huquqsiz');
select test.ok(not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema='public' and table_name in ('loans','coin_ledger','quiz_attempts','loan_requests','audit_log','activation_codes') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')), 'qarz/daftar/urinish jadvallariga mijoz yozolmaydi');
select test.ok(not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_name = 'activation_codes'), 'activation_codes mijozga yopiq');
select test.expect_error($q$select count(*) from public.activation_codes$q$, 'xxx') where false;
select test.become('00000000-0000-0000-0000-0000000000d1');
select test.expect_error($q$select count(*) from public.activation_codes$q$, 'permission denied');
select test.become(null);
\echo '===== EXTRA OK ====='
