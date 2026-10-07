-- Funcionalidade 15 · Lista de nomes: votos privados (RN-06), match uma vez com push para quem curtiu primeiro (RN-05),
-- nome próprio normalizado (RN-05/10), ranking único (RN-04) e "Este é o nome!" (RN-07).
begin;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000015a1', 'gestante@teste.dev'),
  ('00000000-0000-0000-0000-0000000015c1', 'parceiro@teste.dev'),
  ('00000000-0000-0000-0000-0000000015d1', 'outra@teste.dev');
delete from public.membros_familia where profile_id = '00000000-0000-0000-0000-0000000015c1';
insert into public.membros_familia (familia_id, profile_id, papel)
  select familia_id, '00000000-0000-0000-0000-0000000015c1', 'parceiro' from public.membros_familia where profile_id = '00000000-0000-0000-0000-0000000015a1';
insert into public.names_catalog (id, name, sex_hint, meaning, syllables, saint_name, saint_day, reviewed) values
  ('a1500000-0000-0000-0000-000000000001', 'Helena', 'f', 'tocha', 3, 'Santa Helena', '08-18', true),
  ('a1500000-0000-0000-0000-000000000002', 'Miguel', 'm', 'quem é como Deus?', 2, 'São Miguel Arcanjo', '09-29', true),
  ('a1500000-0000-0000-0000-000000000003', 'Maria', 'f', null, 3, null, null, false);
select throws_ok($$ insert into public.names_catalog (name, sex_hint, syllables) values ('HELENA', 'f', 3) $$, '23505', null, 'catálogo único sem diferença de maiúscula');

set local role authenticated;
-- Ela curte Helena, Miguel e "joaquim" (nome próprio); descarta Maria.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000015a1","role":"authenticated"}';
insert into public.name_votes (id, name_id, vote) values
  ('b1500000-0000-0000-0000-000000000001', 'a1500000-0000-0000-0000-000000000001', 'like'),
  ('b1500000-0000-0000-0000-000000000002', 'a1500000-0000-0000-0000-000000000002', 'like'),
  ('b1500000-0000-0000-0000-000000000003', 'a1500000-0000-0000-0000-000000000003', 'dislike');
insert into public.name_votes (id, custom_name, vote) values ('b1500000-0000-0000-0000-000000000004', '  Joaquim  ', 'like');
select is((select custom_name from public.name_votes where id = 'b1500000-0000-0000-0000-000000000004'), 'Joaquim', 'nome próprio sem espaços nas pontas');
select throws_ok($$ insert into public.name_votes (id, custom_name, vote) values (gen_random_uuid(), 'JOAQUIM', 'like') $$, '23505', null, 'mesmo nome próprio (caixa e acento) não duplica o voto');
select throws_ok($$ insert into public.name_votes (id, custom_name, vote) values (gen_random_uuid(), 'R2-D2', 'like') $$, '23514', null, 'nome próprio só com letras, espaço e hífen');
select throws_ok($$ insert into public.name_votes (id, name_id, custom_name, vote) values (gen_random_uuid(), 'a1500000-0000-0000-0000-000000000001', 'Helena', 'like') $$, '23514', null, 'exatamente um entre catálogo e nome próprio');
select throws_ok($$ insert into public.name_votes (id, custom_name, vote) values (gen_random_uuid(), repeat('a', 41), 'like') $$, '23514', null, 'nome próprio até 40');
select is((select count(*) from public.name_matches), 0::bigint, 'sem o voto dele, nada de match');

-- Ranking (RN-04): dar a posição 1 a Miguel tira a de Helena.
update public.name_votes set rank = 1, atualizado_em = now() + interval '1 second' where id = 'b1500000-0000-0000-0000-000000000001';
update public.name_votes set rank = 1, atualizado_em = now() + interval '2 seconds' where id = 'b1500000-0000-0000-0000-000000000002';
select is((select array_agg(coalesce(rank::text, '-') order by id) from public.name_votes where vote = 'like'), array['-', '1', '-'], 'RN-04: posição única por pessoa');
select throws_ok($$ update public.name_votes set rank = 11, atualizado_em = now() + interval '3 seconds' where id = 'b1500000-0000-0000-0000-000000000002' $$, '23514', null, 'ranking de 1 a 10');
update public.name_votes set vote = 'dislike', atualizado_em = now() + interval '4 seconds' where id = 'b1500000-0000-0000-0000-000000000002';
select is((select rank from public.name_votes where id = 'b1500000-0000-0000-0000-000000000002'), null::smallint, 'descartado sai do ranking');
update public.name_votes set vote = 'like', atualizado_em = now() + interval '5 seconds' where id = 'b1500000-0000-0000-0000-000000000002';

-- Ele (RN-06) não vê os votos dela; curte Helena e "Joaquim" sem acento/caixa diferente: dois matches.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000015c1","role":"authenticated"}';
select is((select count(*) from public.name_votes), 0::bigint, 'critério: ele não vê os nomes que só ela curtiu');
insert into public.name_votes (id, name_id, vote) values ('c1500000-0000-0000-0000-000000000001', 'a1500000-0000-0000-0000-000000000001', 'like');
insert into public.name_votes (id, custom_name, vote) values ('c1500000-0000-0000-0000-000000000002', 'joaquim', 'like');
insert into public.name_votes (id, name_id, vote) values ('c1500000-0000-0000-0000-000000000003', 'a1500000-0000-0000-0000-000000000003', 'like');
select is((select count(*) from public.name_matches where desfeito_em is null), 2::bigint, 'critério: o que os dois curtiram vira match (Maria, descartada por ela, não)');
select is((select array_agg(coalesce(custom_name, name_id::text) order by chave) from public.name_matches), array['a1500000-0000-0000-0000-000000000001', 'Joaquim'], 'RN-05: nome próprio casa sem acento e sem caixa');
select is((select segundo from public.name_matches where name_id = 'a1500000-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-0000000015c1'::uuid, 'quem curtiu por último fica como "segundo" (vê a animação)');

reset role;
select is((select count(*) from public.avisos where tipo = 'name_match' and para = '00000000-0000-0000-0000-0000000015a1' and push_pendente), 2::bigint, 'RN-05: o primeiro recebe o push name_match');
select is((select count(*) from public.avisos where tipo = 'name_match' and para = '00000000-0000-0000-0000-0000000015c1'), 0::bigint, 'quem curtiu por último não recebe push');
select ok(not exists (select 1 from public.avisos where tipo = 'name_match' and (titulo || corpo) ilike '%helena%'), 'o push não diz o nome');

-- Desfaz e refaz: o match volta, sem push novo.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000015c1","role":"authenticated"}';
update public.name_votes set apagado_em = now(), atualizado_em = now() + interval '1 second' where id = 'c1500000-0000-0000-0000-000000000001';
select is((select count(*) from public.name_matches where desfeito_em is null), 1::bigint, 'desfazer o voto desfaz o match');
update public.name_votes set apagado_em = null, atualizado_em = now() + interval '2 seconds' where id = 'c1500000-0000-0000-0000-000000000001';
select is((select count(*) from public.name_matches where desfeito_em is null), 2::bigint, 'curtir de novo refaz o match');
reset role;
select is((select count(*) from public.avisos where tipo = 'name_match'), 2::bigint, 'RN-05: o match cria o aviso uma vez só');

-- RN-07: com parceiro, só um match vira o nome; outra família não vê nada.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000015a1","role":"authenticated"}';
select throws_ok($$ select public.escolher_nome('a1500000-0000-0000-0000-000000000002') $$, 'P0001', 'nome_sem_match', 'RN-07: sem match, não escolhe');
select is(public.escolher_nome('c:joaquim'), 'Joaquim', 'critério: "Este é o nome!" grava o nome do bebê');
select is((select baby_name from public.minha_familia()), 'Joaquim', 'o nome chega pela minha_familia');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000015d1","role":"authenticated"}';
select is((select count(*) from public.name_matches), 0::bigint, 'outra família não vê os matches');

select * from finish();
rollback;
