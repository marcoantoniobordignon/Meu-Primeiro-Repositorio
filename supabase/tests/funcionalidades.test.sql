-- Funcionalidades 02–06: RLS (quem vê o quê), restrições do modelo e Storage. `supabase test db`.
begin;
select plan(50);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gestante@teste.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'outra@teste.dev'),
  ('00000000-0000-0000-0000-00000000000c', 'parceiro@teste.dev'),
  ('00000000-0000-0000-0000-00000000000d', 'baba@teste.dev');

-- ---------------------------------------------------------------------------
-- A gestante registra um pouco de tudo.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

insert into public.medications (id, name, schedule_type, times, starts_on, color_key) values ('a0000000-0000-0000-0000-000000000001', 'Sulfato ferroso', 'fixed_times', '{08:00,20:00}', current_date, 'primaria');
insert into public.medication_doses (id, medication_id, scheduled_at) values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', now() + interval '1 hour');
insert into public.appointments (id, starts_at, provider_name, location) values ('b0000000-0000-0000-0000-000000000001', now() + interval '10 days', 'Dra. Ana', 'Clínica Sol');
insert into public.appointment_measures (id, appointment_id, weight_kg, bp_sys, bp_dia, notes_after) values ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 70.5, 110, 70, 'repouso');
insert into public.appointment_questions (id, text) values ('b0000000-0000-0000-0000-000000000002', 'Posso viajar?');
insert into public.user_exams (id, catalog_code, window_start_date, window_end_date) values ('c0000000-0000-0000-0000-000000000001', 'morpho', current_date, current_date + 30);
insert into public.belly_photos (id, gest_week, taken_on, storage_path) values ('d0000000-0000-0000-0000-000000000001', 22, current_date, 'barriga/d1.jpg');
insert into public.diary_entries (id, kind, body) values ('e0000000-0000-0000-0000-000000000001', 'free', 'Só minha');
insert into public.diary_entries (id, kind, body, shared_with_partner) values ('e0000000-0000-0000-0000-000000000002', 'free', 'Para ele ler', true);
insert into public.diary_entries (id, kind, milestone_code, body) values ('e0000000-0000-0000-0000-000000000003', 'milestone', 'first_kick', 'Senti no ônibus');
insert into public.diary_photos (id, entry_id, position, storage_path) values ('e0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000003', 1, 'diario/e3/f1.jpg');

select is((select criado_por from public.diary_entries where id = 'e0000000-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-00000000000a'::uuid, 'autora preenchida pela sessão');
select is((select familia_id is not null from public.medications limit 1), true, 'família preenchida pela sessão');

-- Upsert de quem sincroniza (insert ... on conflict do update) passa pela RLS.
select lives_ok($$ insert into public.medication_doses (id, medication_id, scheduled_at, status, taken_at, source, atualizado_em)
  values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', now() + interval '1 hour', 'taken', now(), 'app', now() + interval '1 second')
  on conflict (id) do update set status = excluded.status, taken_at = excluded.taken_at, source = excluded.source, atualizado_em = excluded.atualizado_em $$, 'gestante faz upsert da dose');
select is((select status from public.medication_doses where id = 'a0000000-0000-0000-0000-000000000002'), 'taken', 'dose registrada');

-- ---------------------------------------------------------------------------
-- Restrições do modelo
-- ---------------------------------------------------------------------------
select throws_ok($$ insert into public.appointment_measures (id, appointment_id, weight_kg) values ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 29) $$, '23514', null, 'CRO RN-04: peso fora da faixa');
select throws_ok($$ update public.appointment_measures set bp_sys = 261, atualizado_em = now() + interval '1 minute' $$, '23514', null, 'CRO RN-04: pressão fora da faixa');
select throws_ok($$ insert into public.appointment_questions (id, text) values (gen_random_uuid(), 'oi') $$, '23514', null, 'CRO: pergunta com menos de 3 letras');
select throws_ok($$ insert into public.diary_entries (id, kind) values (gen_random_uuid(), 'free') $$, '23514', null, 'DIA RN-01: sem texto, áudio nem foto');
select lives_ok($$ insert into public.diary_entries (id, kind, photo_count) values (gen_random_uuid(), 'free', 1) $$, 'DIA RN-01: só foto vale');
select lives_ok($$ insert into public.diary_entries (id, kind, audio_path, audio_seconds) values (gen_random_uuid(), 'free', 'diario/x/audio.webm', 60) $$, 'DIA RN-01: só áudio vale');
select throws_ok($$ insert into public.diary_entries (id, kind, audio_path, audio_seconds) values (gen_random_uuid(), 'free', 'diario/x/a.webm', 181) $$, '23514', null, 'DIA RN-05: áudio de até 180 s');
select throws_ok($$ insert into public.diary_entries (id, kind, milestone_code, body) values (gen_random_uuid(), 'milestone', 'first_kick', 'de novo') $$, '23505', null, 'DIA RN-02: um marco por autora');
select throws_ok($$ insert into public.diary_entries (id, kind, body, entry_date) values (gen_random_uuid(), 'free', 'futuro', current_date + 5) $$, '23514', null, 'DIA RN-07: data futura');
select throws_ok($$ insert into public.diary_entries (id, kind, milestone_code, body) values (gen_random_uuid(), 'free', 'heartbeat', 'x') $$, '23514', null, 'DIA: entrada livre não leva marco');
select throws_ok($$ insert into public.belly_photos (id, gest_week, taken_on, storage_path) values (gen_random_uuid(), 22, current_date, 'barriga/outra.jpg') $$, '23505', null, 'BAR RN-01: uma foto por semana');
select throws_ok($$ insert into public.belly_photos (id, gest_week, taken_on, storage_path) values (gen_random_uuid(), 43, current_date, 'barriga/x.jpg') $$, '23514', null, 'BAR: semanas 4 a 42');
select throws_ok($$ update public.belly_photos set gest_week = 23, atualizado_em = now() + interval '1 minute' $$, 'P0001', 'gest_week é imutável', 'BAR RN-12: semana gravada e imutável');
select lives_ok($$ update public.belly_photos set storage_path = 'barriga/d1-nova.jpg', atualizado_em = now() + interval '1 minute' $$, 'BAR RN-01: substituir reaproveita a linha');
select throws_ok($$ insert into public.user_exams (id, status) values (gen_random_uuid(), 'to_schedule') $$, '23514', null, 'EXA RN-09: personalizado precisa de nome');
select throws_ok($$ insert into public.user_exams (id, catalog_code) values (gen_random_uuid(), 'morpho') $$, '23505', null, 'EXA: um exame do catálogo por gestação');
select throws_ok($$ insert into public.user_exams (id, catalog_code, status) values (gen_random_uuid(), 'gbs', 'scheduled') $$, '23514', null, 'EXA RN-06: marcado precisa de data');
select throws_ok($$ insert into public.medication_doses (id, medication_id, scheduled_at) select gen_random_uuid(), medication_id, scheduled_at from public.medication_doses limit 1 $$, '23505', null, 'MED: uma dose por horário');
select throws_ok($$ insert into public.medications (id, name, schedule_type, times, color_key) values (gen_random_uuid(), 'x', 'fixed_times', '{06:00,10:00,14:00,18:00,22:00}', 'primaria') $$, '23514', null, 'MED: até 4 horários');
select throws_ok($$ insert into public.medications (id, name, schedule_type, interval_hours, interval_anchor, color_key) values (gen_random_uuid(), 'x', 'interval', 3, '08:00', 'primaria') $$, '23514', null, 'MED: intervalo de 4 a 24 h');
select throws_ok($$ insert into public.medication_doses (id, medication_id, scheduled_at, snooze_count) values (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', now() + interval '3 hours', 3) $$, '23514', null, 'MED RN-05: no máximo 2 adiamentos');

-- ARQ-02: escrita mais antiga não sobrescreve a mais nova.
update public.appointments set location = 'antigo', atualizado_em = now() - interval '1 day' where id = 'b0000000-0000-0000-0000-000000000001';
select is((select location from public.appointments where id = 'b0000000-0000-0000-0000-000000000001'), 'Clínica Sol', 'ARQ-02 vale nas tabelas novas');

-- Storage: sobe o arquivo de quem é autora da linha; nome solto não.
select lives_ok($$ insert into storage.objects (bucket_id, name, owner, owner_id) values ('ninho-privado', 'diario/e3/f1.jpg', auth.uid(), auth.uid()::text) $$, 'Storage: autora sobe a foto do diário');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('ninho-privado', 'qualquer/coisa.jpg', auth.uid()::text) $$, '42501', null, 'Storage: arquivo sem linha não sobe');

-- Convites: parceiro e cuidadora entram na família (o token passa por uma variável de sessão:
-- quem é convidado não lê a tabela de convites).
select set_config('teste.parceiro', public.criar_convite('parceiro'), true);
select set_config('teste.cuidador', public.criar_convite('cuidador'), true);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select public.aceitar_convite(current_setting('teste.parceiro'), 'Rafa');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';
select public.aceitar_convite(current_setting('teste.cuidador'), 'Babá');

-- ---------------------------------------------------------------------------
-- Parceiro: agenda sim (padrão); medidas, remédios e barriga não; diário só o compartilhado.
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select is((select count(*) from public.medications), 0::bigint, 'MED RN-14: parceiro nunca vê medicamentos');
select is((select count(*) from public.medication_doses), 0::bigint, 'MED RN-14: nem as doses');
select is((select count(*) from public.appointments), 1::bigint, 'CRO RN-10: parceiro vê a agenda');
select is((select count(*) from public.appointment_measures), 0::bigint, 'CRO RN-10: parceiro nunca vê medidas nem orientações');
select is((select count(*) from public.appointment_questions), 1::bigint, 'CRO RN-10: parceiro vê a pauta');
select lives_ok($$ insert into public.appointment_questions (id, text) values ('b0000000-0000-0000-0000-000000000003', 'E o enxoval?') $$, 'CRO RN-10: parceiro anota pergunta');
select is((select criado_por from public.appointment_questions where id = 'b0000000-0000-0000-0000-000000000003'), '00000000-0000-0000-0000-00000000000c'::uuid, 'com o autor');
select throws_ok($$ insert into public.appointments (id, starts_at) values (gen_random_uuid(), now()) $$, '42501', null, 'parceiro não cria consulta');
select is((select count(*) from public.belly_photos), 0::bigint, 'BAR RN-11: sem a permissão, parceiro não vê a grade');
select is((select count(*) from public.diary_entries), 1::bigint, 'DIA RN-09: parceiro só vê a compartilhada');
select is((select count(*) from public.diary_photos), 0::bigint, 'DIA RN-09: nem as fotos das outras');
insert into public.diary_entries (id, kind, body) values ('e0000000-0000-0000-0000-000000000009', 'free', 'Escrito pelo pai');
update public.diary_entries set body = 'mexi', atualizado_em = now() + interval '1 minute' where id = 'e0000000-0000-0000-0000-000000000002';
select is((select body from public.diary_entries where id = 'e0000000-0000-0000-0000-000000000002'), 'Para ele ler', 'DIA RN-09: só a autora edita a dela');
select is((select count(*) from public.user_exams), 0::bigint, 'PAR RN-04: parceiro não lê a tabela de exames (só os marcados, pela RPC)');

-- ---------------------------------------------------------------------------
-- A gestante liga as fotos e desliga a agenda; vê a entrada do parceiro.
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select count(*) from public.diary_entries where criado_por = '00000000-0000-0000-0000-00000000000c'), 1::bigint, 'DIA RN-09: entrada do parceiro aparece sempre para a gestante');
select lives_ok($$ select public.definir_permissoes_parceiro('00000000-0000-0000-0000-00000000000c', '{"belly_photos": true, "agenda": false}') $$, 'gestante muda as permissões');
select is((select permissoes from public.meus_membros() where papel = 'parceiro'), '{"agenda": false, "birth_plan": true, "belly_photos": true}'::jsonb, 'meus_membros devolve as permissões');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select is((select count(*) from public.belly_photos), 1::bigint, 'BAR RN-11: com a permissão, parceiro vê a grade');
select is((select count(*) from public.appointments), 0::bigint, 'CRO RN-10: sem `agenda`, nada da agenda');
select throws_ok($$ select public.definir_permissoes_parceiro('00000000-0000-0000-0000-00000000000c', '{"agenda": true}') $$, 'P0001', 'só a gestante muda as permissões', 'parceiro não muda as próprias permissões');

-- Cuidadora e outra família: nada de saúde da gestação.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';
select is((select count(*) from public.appointments) + (select count(*) from public.user_exams) + (select count(*) from public.diary_entries) + (select count(*) from public.belly_photos) + (select count(*) from public.medications), 0::bigint, 'cuidadora não vê agenda, exames, diário, barriga nem remédios');
select is((select count(*) from storage.objects), 0::bigint, 'Storage: cuidadora não lê o arquivo do diário');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*) from public.appointments) + (select count(*) from public.user_exams) + (select count(*) from public.diary_entries) + (select count(*) from public.belly_photos) + (select count(*) from public.medications) + (select count(*) from public.appointment_questions), 0::bigint, 'outra família não lê nada (RLS)');

select * from finish();
rollback;
