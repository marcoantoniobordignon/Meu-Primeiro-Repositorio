-- Funcionalidade 17 · Modo fé: publicação com revisão (RN-05), uma oração por semana (RN-03),
-- favoritos de cada pessoa (RN-02) e contadores anônimos (RN-10).
begin;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000017a1', 'gestante@teste.dev'),
  ('00000000-0000-0000-0000-0000000017b1', 'outra@teste.dev'),
  ('00000000-0000-0000-0000-0000000017e1', 'revisor@teste.dev');
update public.profiles set is_reviewer = true where id = '00000000-0000-0000-0000-0000000017e1';

insert into public.faith_prayers (id, slug, kind, title, body, week, saint_name, saint_day, source_label, position) values
  ('f1700000-0000-0000-0000-000000000001', 'oracao-semana-12', 'weekly', 'Semana 12', 'Texto', 12, null, null, 'Texto original do Ninho', 12),
  ('f1700000-0000-0000-0000-000000000002', 'ave-maria', 'fixed', 'Ave-Maria', 'Ave Maria...', null, null, null, 'Oração tradicional da Igreja', 5),
  ('f1700000-0000-0000-0000-000000000003', 'sao-gerardo', 'intercessor', 'São Gerardo Majella', 'Texto', null, 'São Gerardo Majella', '10-16', 'Devoção tradicional', 2);
select throws_ok($$ update public.faith_prayers set status = 'published' where slug = 'ave-maria' $$, '23514', null, 'RN-05: publicar exige revisor e data');
select throws_ok($$ insert into public.faith_prayers (slug, kind, title, body, source_label) values ('sem-semana', 'weekly', 't', 'b', 'f') $$, '23514', null, 'RN-03: semanal precisa da semana');
select throws_ok($$ insert into public.faith_prayers (slug, kind, title, body, week, source_label) values ('fixa-com-semana', 'fixed', 't', 'b', 3, 'f') $$, '23514', null, 'só a semanal tem semana');
select throws_ok($$ insert into public.faith_prayers (slug, kind, title, body, week, source_label) values ('semana-41', 'weekly', 't', 'b', 41, 'f') $$, '23514', null, 'RN-03: semanas de 1 a 40');
select throws_ok($$ insert into public.faith_prayers (slug, kind, title, body, source_label) values ('longa', 'fixed', 't', repeat('a', 1201), 'f') $$, '23514', null, 'texto até 1200');
select throws_ok($$ insert into public.faith_prayers (slug, kind, title, body, source_label) values ('sem-fonte', 'fixed', 't', 'b', ' ') $$, '23514', null, 'RN-05: fonte obrigatória');
select throws_ok($$ insert into public.faith_prayers (slug, kind, title, body, saint_day, source_label) values ('dia-ruim', 'intercessor', 't', 'b', '16/10', 'f') $$, '23514', null, 'dia do santo em MM-DD');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000017a1","role":"authenticated"}';
select is((select count(*) from public.faith_prayers), 0::bigint, 'RN-05: rascunho não aparece');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000017e1","role":"authenticated"}';
update public.faith_prayers set status = 'published', reviewed_by = 'Pe. João', reviewed_on = '2026-09-30';
select is((select count(*) from public.faith_prayers where status = 'published'), 3::bigint, 'o revisor publica com revisão');
select throws_ok($$ insert into public.faith_prayers (slug, kind, title, body, week, source_label, status, reviewed_by, reviewed_on) values ('outra-12', 'weekly', 't', 'b', 12, 'f', 'published', 'Pe. João', '2026-09-30') $$, '23505', null, 'RN-03: uma oração publicada por semana');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000017a1","role":"authenticated"}';
select is((select count(*) from public.faith_prayers), 3::bigint, 'publicada aparece');
update public.faith_prayers set title = 'mexi';
select is((select count(*) from public.faith_prayers where title = 'mexi'), 0::bigint, 'app não escreve orações');
insert into public.faith_favorites (id, prayer_id) values ('f1700000-0000-0000-0000-0000000000f1', 'f1700000-0000-0000-0000-000000000002');
select is((select count(*) from public.faith_favorites), 1::bigint, 'favoritar');
select throws_ok($$ insert into public.faith_favorites (id, user_id, prayer_id) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000017b1', 'f1700000-0000-0000-0000-000000000003') $$, '42501', null, 'não favorita por outra pessoa');
-- RN-10: o app não lê nem escreve os contadores direto.
select throws_ok($$ insert into public.anon_counters (dia, chave, contagem) values (current_date, 'faith_on', 1) $$, '42501', null, 'RN-10: sem escrita direta');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000017b1","role":"authenticated"}';
select is((select count(*) from public.faith_favorites), 0::bigint, 'favoritos são de cada um');

-- RN-10: a soma anônima, inclusive sem sessão (o app manda só com a chave anônima).
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select lives_ok($$ select public.somar_contadores_anonimos(jsonb_build_array(jsonb_build_object('dia', current_date, 'chave', 'faith_on', 'n', 2), jsonb_build_object('dia', current_date, 'chave', 'prayer_viewed', 'n', 1))) $$, 'RN-10: soma sem usuário');
select throws_ok($$ select public.somar_contadores_anonimos(jsonb_build_array(jsonb_build_object('dia', current_date - 60, 'chave', 'faith_on', 'n', 1))) $$, 'P0001', 'itens_invalidos', 'dia velho é recusado');
reset role;
select is((select array_agg(chave || '=' || contagem order by chave) from public.anon_counters), array['faith_on=2', 'prayer_viewed=1'], 'só dia, chave e contagem');

select * from finish();
rollback;
