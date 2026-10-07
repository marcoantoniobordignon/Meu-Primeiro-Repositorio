-- Funcionalidade 08 · Calendário: eventos próprios (RN-06), parceiro (RN-11), feed iCal (RN-08).
begin;
select plan(26);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'gestante@teste.dev'),
  ('00000000-0000-0000-0000-0000000008c1', 'parceiro@teste.dev'),
  ('00000000-0000-0000-0000-0000000008b1', 'outra@teste.dev');
update public.profiles set nome = 'Helena', dpp = '2027-03-08', modo = 'gestacao', tz = 'America/Sao_Paulo', onboarding_concluido_em = now() where id = '00000000-0000-0000-0000-0000000008a1';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000008a1","role":"authenticated"}';

-- RN-06
select lives_ok($$ insert into public.calendar_events (id, title, category, starts_at, remind_offset_minutes) values ('e8000000-0000-0000-0000-000000000001', 'Curso de gestantes', 'course', '2026-10-15T22:00:00Z', 60) $$, 'evento com hora e lembrete de 1 hora');
select lives_ok($$ insert into public.calendar_events (id, title, all_day, all_day_date, visible_to_partner, notes) values ('e8000000-0000-0000-0000-000000000002', 'Chá de bebê', true, '2026-11-01', false, 'surpresa') $$, 'evento de dia inteiro');
select is((select category from public.calendar_events where id = 'e8000000-0000-0000-0000-000000000002'), 'other', 'categoria padrão other');
select throws_ok($$ insert into public.calendar_events (id, title, starts_at) values (gen_random_uuid(), '   ', now()) $$, '23514', null, 'RN-06: título obrigatório');
select throws_ok($$ insert into public.calendar_events (id, title, starts_at) values (gen_random_uuid(), repeat('a', 81), now()) $$, '23514', null, 'título até 80');
select throws_ok($$ insert into public.calendar_events (id, title) values (gen_random_uuid(), 'Sem hora') $$, '23514', null, 'RN-06: sem dia inteiro, a hora é obrigatória');
select throws_ok($$ insert into public.calendar_events (id, title, all_day, all_day_date, starts_at) values (gen_random_uuid(), 'Dia inteiro com hora', true, current_date, now()) $$, '23514', null, 'RN-06: dia inteiro, sem hora');
select throws_ok($$ insert into public.calendar_events (id, title, starts_at, remind_offset_minutes) values (gen_random_uuid(), 'x', now(), 30) $$, '23514', null, 'RN-06: lembrete só nenhum, na hora, 1 h ou 1 dia');
select throws_ok($$ insert into public.calendar_events (id, title, starts_at, category) values (gen_random_uuid(), 'x', now(), 'party') $$, '23514', null, 'categoria fora da lista');

insert into public.appointments (id, starts_at, provider_name, location) values ('a8000000-0000-0000-0000-000000000001', '2026-10-09T13:00:00Z', 'Dra. Ana', 'Clínica Sol');
insert into public.user_exams (id, catalog_code, status, scheduled_at, window_start_date, window_end_date) values
  ('c8000000-0000-0000-0000-000000000001', 'morpho', 'scheduled', '2026-10-20T12:00:00Z', current_date, current_date + 20),
  ('c8000000-0000-0000-0000-000000000002', 'gbs', 'done', '2026-09-01T12:00:00Z', current_date - 40, current_date - 30);
insert into public.medications (id, name, schedule_type, times, starts_on, color_key) values ('a8000000-0000-0000-0000-0000000000f1', 'Ferro', 'fixed_times', '{08:00}', current_date, 'primaria');

-- RN-08: o link do feed.
select set_config('teste.feed', public.feed_calendario(), true);
select matches(current_setting('teste.feed'), '^[a-f0-9]{48}$', 'feed: token de 24 bytes');
select is(public.feed_calendario(), current_setting('teste.feed'), 'gerar de novo devolve o mesmo link');
select set_config('teste.feed2', public.feed_calendario(true), true);
select isnt(current_setting('teste.feed2'), current_setting('teste.feed'), 'pedir um novo revoga o anterior');
select is((select count(*) from public.calendar_feed_tokens where revoked_at is null), 1::bigint, 'um link ativo por gestação');
select throws_ok($$ select count(*) from public.calendar_items_v $$, '42501', null, 'a view do feed não é lida pelo app (só pela Edge Function)');

-- Parceiro entra com agenda ligada.
select set_config('teste.convite', (public.criar_convite_parceiro())::text, true);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000008c1","role":"authenticated"}';
select public.aceitar_convite_parceiro(current_setting('teste.convite')::jsonb ->> 'token');
select is((select count(*) from public.calendar_events), 1::bigint, 'RN-11: parceiro vê só os eventos visíveis');
select is((select title from public.calendar_events), 'Curso de gestantes', 'RN-11: e não o "só para mim"');
select throws_ok($$ insert into public.calendar_events (id, title, starts_at) values (gen_random_uuid(), 'dele', now()) $$, '42501', null, 'eventos próprios: só a gestante cria');
select throws_ok($$ select public.feed_calendario() $$, 'P0001', 'so_a_gestante', 'o feed é dela');
select is((select count(*) from public.calendar_feed_tokens), 0::bigint, 'o parceiro não lê o token do feed');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000008a1","role":"authenticated"}';
select public.definir_permissoes_parceiro('00000000-0000-0000-0000-0000000008c1', '{"agenda": false}');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000008c1","role":"authenticated"}';
select is((select count(*) from public.calendar_events), 0::bigint, 'RN-11: sem agenda, nada de eventos');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000008b1","role":"authenticated"}';
select is((select count(*) from public.calendar_events) + (select count(*) from public.calendar_feed_tokens), 0::bigint, 'outra família não lê nada');

-- O que a Edge Function vê (service role): consultas, exames marcados, eventos próprios e DPP; nada de medicamentos.
reset role;
select set_eq(
  $$ select item_type || ':' || title from public.calendar_items_v where familia_id = (select familia_id from public.calendar_feed_tokens where token = current_setting('teste.feed2')) $$,
  array['appointment:Dra. Ana', 'exam:morpho', 'custom:Curso de gestantes', 'custom:Chá de bebê', 'edd:Data provável do parto'],
  'RN-08: o feed leva consultas, exames marcados, eventos próprios e DPP'
);
select is((select location from public.calendar_items_v where item_type = 'appointment'), 'Clínica Sol', 'decidido: título e local da consulta');
select hasnt_column('public', 'calendar_items_v', 'notes', 'RN-08: nunca as notas');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000008a1","role":"authenticated"}';
select lives_ok($$ select public.revogar_feed_calendario() $$, 'revogar');
select is((select count(*) from public.calendar_feed_tokens where revoked_at is null), 0::bigint, 'RN-08: revogado, o link deixa de valer');

select * from finish();
rollback;
