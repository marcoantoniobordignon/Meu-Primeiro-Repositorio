-- Funcionalidade 11 · Adaptação por trimestre: publicação com revisão (RN-09), trimestre derivado da semana,
-- leituras e favoritos de cada pessoa (RN-04), virada vista uma vez (RN-06) e a categoria do push.
begin;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000011a1', 'gestante@teste.dev'),
  ('00000000-0000-0000-0000-0000000011b1', 'outra@teste.dev'),
  ('00000000-0000-0000-0000-0000000011e1', 'revisora@teste.dev');
update public.profiles set is_reviewer = true where id = '00000000-0000-0000-0000-0000000011e1';

-- Conteúdo inicial entra como rascunho, sem revisão.
insert into public.articles (id, slug, title, summary, body_md, week_from, week_to, reading_minutes, featured, position) values
  ('a1100000-0000-0000-0000-000000000001', 'semana-10', 'Semana 10', 'Resumo', 'Corpo', 10, 10, 2, true, 1),
  ('a1100000-0000-0000-0000-000000000002', 'enjoo', 'Enjoo', 'Resumo', 'Corpo', 4, 13, 3, false, 1),
  ('a1100000-0000-0000-0000-000000000003', 'semana-14', 'Semana 14', 'Resumo', 'Corpo', 14, 14, 2, true, 1),
  ('a1100000-0000-0000-0000-000000000004', 'mala', 'Mala', 'Resumo', 'Corpo', 28, 40, 4, false, 3);
select is((select array_agg(trimester order by week_from) from public.articles), array[1, 1, 2, 3]::smallint[], 'trimestre derivado de week_from (14 e 28 viram)');
select throws_ok($$ update public.articles set status = 'published' where slug = 'enjoo' $$, '23514', null, 'RN-09: publicar exige revisor e data');
select throws_ok($$ update public.articles set status = 'published', reviewed_by = '  ', reviewed_on = current_date where slug = 'enjoo' $$, '23514', null, 'RN-09: revisor em branco não vale');
select throws_ok($$ insert into public.articles (slug, title, summary, body_md, week_from, week_to) values ('x', repeat('a', 91), 's', 'b', 5, 5) $$, '23514', null, 'título até 90');
select throws_ok($$ insert into public.articles (slug, title, summary, body_md, week_from, week_to) values ('y', 't', repeat('a', 201), 'b', 5, 5) $$, '23514', null, 'resumo até 200');
select throws_ok($$ insert into public.articles (slug, title, summary, body_md, week_from, week_to) values ('z', 't', 's', 'b', 20, 19) $$, '23514', null, 'week_to não vem antes de week_from');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000011a1","role":"authenticated"}';
select is((select count(*) from public.articles), 0::bigint, 'RN-09: rascunho não aparece');
update public.articles set title = 'mexi';
select is((select count(*) from public.articles where title = 'mexi'), 0::bigint, 'app não escreve artigos');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000011e1","role":"authenticated"}';
select is((select count(*) from public.articles), 4::bigint, 'revisor vê os rascunhos');
update public.articles set status = 'published', reviewed_by = 'Dra. Ana Lima', reviewed_on = '2026-09-30' where slug in ('semana-10', 'enjoo', 'semana-14');
select ok((select bool_and(published_at is not null) from public.articles where status = 'published'), 'publicar carimba published_at');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000011a1","role":"authenticated"}';
select is((select count(*) from public.articles), 3::bigint, 'publicado aparece para todo mundo');
select is((select (reviewed_by, reviewed_on)::text from public.articles where slug = 'semana-10'), '("Dra. Ana Lima",2026-09-30)', 'RN-09: revisor e data vêm junto (rodapé)');

-- RN-04: leitura e favorito, com a fila offline (upsert por id).
insert into public.article_reads (id, article_id, first_opened_at) values ('b1100000-0000-0000-0000-000000000001', 'a1100000-0000-0000-0000-000000000001', '2026-10-01 10:00');
insert into public.article_reads (id, article_id, first_opened_at, read_at, atualizado_em) values ('b1100000-0000-0000-0000-000000000001', 'a1100000-0000-0000-0000-000000000001', '2026-10-01 10:00', '2026-10-01 10:01', now() + interval '1 second')
  on conflict (id) do update set read_at = excluded.read_at, atualizado_em = excluded.atualizado_em;
select isnt((select read_at from public.article_reads where id = 'b1100000-0000-0000-0000-000000000001'), null, 'RN-04: lido marca read_at');
update public.article_reads set read_at = null, is_favorite = true, atualizado_em = now() + interval '2 seconds' where id = 'b1100000-0000-0000-0000-000000000001';
select is((select (read_at is not null, is_favorite)::text from public.article_reads where id = 'b1100000-0000-0000-0000-000000000001'), '(t,t)', 'lido não volta atrás; favorito muda');
select throws_ok($$ insert into public.article_reads (id, article_id) values (gen_random_uuid(), 'a1100000-0000-0000-0000-000000000001') $$, '23505', null, 'uma leitura por pessoa e artigo');
select throws_ok($$ insert into public.article_reads (id, user_id, article_id) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000011b1', 'a1100000-0000-0000-0000-000000000002') $$, '42501', null, 'não grava leitura de outra pessoa');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000011b1","role":"authenticated"}';
select is((select count(*) from public.article_reads), 0::bigint, 'leituras e favoritos são de cada um');
select lives_ok($$ insert into public.article_reads (id, article_id) values (gen_random_uuid(), 'a1100000-0000-0000-0000-000000000001') $$, 'outra pessoa lê o mesmo artigo');

-- RN-06: a virada vista fica no perfil.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000011a1","role":"authenticated"}';
update public.profiles set t2_seen_at = now(), atualizado_em = now() + interval '1 second' where id = '00000000-0000-0000-0000-0000000011a1';
select isnt((select t2_seen_at from public.profiles where id = '00000000-0000-0000-0000-0000000011a1'), null, 'RN-06: t2_seen_at guardado');

reset role;
select lives_ok($$ insert into public.reminders_sent (familia_id, chave, categoria, tipo, ref, essencial, enviado_em)
  select familia_id, 'trimester:2', 'trimester', 'trimester_turn', 't2', false, now() from public.membros_familia where profile_id = '00000000-0000-0000-0000-0000000011a1' $$, 'RN-06: categoria trimester no log de envios');

select * from finish();
rollback;
