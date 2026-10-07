-- Funcionalidade 09 · FAQ de comidas: publicação com revisão (RN-01/09), busca (RN-02), perguntas e votos (RN-05/06),
-- resposta e rejeição (RN-07/08), favoritos e privacidade das perguntas (funcionalidade 12).
begin;
select plan(35);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'gestante@teste.dev'),
  ('00000000-0000-0000-0000-0000000009b1', 'outra@teste.dev'),
  ('00000000-0000-0000-0000-0000000009e1', 'revisora@teste.dev'),
  ('00000000-0000-0000-0000-0000000009c1', 'parceiro@teste.dev');
update public.profiles set is_reviewer = true, nome = 'Nutri Ana' where id = '00000000-0000-0000-0000-0000000009e1';

-- Semente como rascunho (o conteúdo inicial nunca nasce publicado).
insert into public.faq_foods (id, slug, name, aliases, category, verdict, short_answer, condition_note, source_label) values
  ('f9000000-0000-0000-0000-000000000001', 'acai', 'Açaí', '{"acai na tigela"}', 'fruit_veg', 'caution', 'Pode, se for polpa pasteurizada.', 'Polpa pasteurizada, de procedência confiável', 'Ministério da Saúde'),
  ('f9000000-0000-0000-0000-000000000002', 'peixe-cru', 'Peixe cru (sushi, ceviche)', '{sashimi}', 'fish', 'avoid', 'Evite.', null, 'Ministério da Saúde'),
  ('f9000000-0000-0000-0000-000000000003', 'queijo-coalho', 'Queijo coalho', '{}', 'dairy', 'caution', 'Só pasteurizado.', 'Pasteurizado', 'ANVISA');
select throws_ok($$ update public.faq_foods set status = 'published' where slug = 'acai' $$, '23514', null, 'RN-01/09: publicar exige revisão humana');
select throws_ok($$ insert into public.faq_foods (slug, name, category, verdict, short_answer, source_label) values ('X Y', 'x', 'fish', 'safe', 'x', 'y') $$, '23514', null, 'slug em kebab-case');
select throws_ok($$ insert into public.faq_foods (slug, name, category, verdict, short_answer, source_label) values ('x', 'x', 'fish', 'talvez', 'x', 'y') $$, '23514', null, 'veredito fora da lista');
select throws_ok($$ insert into public.faq_foods (slug, name, category, verdict, short_answer, source_label) values ('y', 'y', 'fish', 'safe', repeat('a', 201), 'y') $$, '23514', null, 'resposta curta até 200');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009a1","role":"authenticated"}';
select is((select count(*) from public.faq_foods), 0::bigint, 'RN-01: rascunho não aparece');
select is((select count(*) from public.buscar_faq('acai')), 0::bigint, 'RN-01: nem na busca');
select throws_ok($$ select public.faq_publicar('f9000000-0000-0000-0000-000000000001', '{}', 'Eu', current_date) $$, '42501', null, 'só o revisor publica');
update public.faq_foods set short_answer = 'mexi';
select is((select count(*) from public.faq_foods where short_answer = 'mexi'), 0::bigint, 'app não escreve verbetes');

-- Perguntas (RN-05/06).
select throws_ok($$ select public.faq_perguntar('oi') $$, 'P0001', 'tamanho', 'RN-05: mínimo de 3 caracteres');
select throws_ok($$ select public.faq_perguntar(repeat('a', 141)) $$, 'P0001', 'tamanho', 'RN-05: máximo de 140');
select throws_ok($$ select public.faq_perguntar('Posso comer essa porra de pequi?') $$, 'P0001', 'ofensa', 'critério: pergunta ofensiva bloqueada');
select throws_ok($$ select public.faq_perguntar('Posso comer PÔRRA?') $$, 'P0001', 'ofensa', 'bloqueio ignora acento e caixa');
select ok(not public.faq_tem_ofensa('Posso comer porcaria de festa?'), 'palavra parecida não é ofensa');
select set_config('teste.p1', public.faq_perguntar('Posso comer pequi?')::text, true);
select is((select (status, votes_count, normalized)::text from public.faq_questions where id = current_setting('teste.p1')::uuid), '(open,1,"posso comer pequi?")', 'pergunta aberta com o voto de quem perguntou');
select public.faq_perguntar('Pode tomar chá de boldo?');
select public.faq_perguntar('Pode comer tapioca recheada?');
select public.faq_perguntar('Pode comer caldo de cana na feira?');
select public.faq_perguntar('Pode comer cuscuz com ovo?');
select throws_ok($$ select public.faq_perguntar('Pode comer pastel de feira?') $$, 'P0001', 'limite_diario', 'RN-05: até 5 por dia');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009b1","role":"authenticated"}';
select is((select count(*) from public.faq_questions), 0::bigint, 'cada pessoa vê só as suas perguntas');
select is((select text from public.faq_perguntas_parecidas('posso comer pequi')), 'Posso comer pequi?', 'RN-06: acha a parecida (≥ 0,6)');
select is((select count(*) from public.faq_perguntas_parecidas('posso comer jaca?')), 0::bigint, 'RN-06: e não acha a diferente');
select throws_ok($$ select public.faq_perguntar('Posso comer pequi') $$, 'P0001', 'parecida', 'RN-06: parecida não vira duplicata');
select is(public.faq_votar(current_setting('teste.p1')::uuid), 2, 'RN-06: "Eu também quero saber" soma 1');
select is(public.faq_votar(current_setting('teste.p1')::uuid), 2, 'RN-06: um voto por pessoa');
select is((select ja_votei from public.faq_perguntas_parecidas('posso comer pequi')), true, 'sabe que já votou');

-- Revisão (RN-07/08).
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009e1","role":"authenticated"}';
select is((select count(*) from public.faq_foods), 3::bigint, 'revisor vê os rascunhos');
select is((select text from public.faq_perguntas_abertas() limit 1), 'Posso comer pequi?', 'painel: abertas por votos');
insert into public.faq_foods (id, slug, name, category, verdict, short_answer, condition_note, source_label) values ('f9000000-0000-0000-0000-000000000004', 'pequi', 'Pequi', 'fruit_veg', 'caution', 'Pode, com cuidado com os espinhos.', 'Bem cozido', 'Guia Alimentar');
select is(public.faq_publicar('f9000000-0000-0000-0000-000000000004', array[current_setting('teste.p1')::uuid], 'Nutri Ana', current_date), 1, 'RN-07: publicar responde a pergunta');
select is((select (status, answered_food_id)::text from public.faq_questions where id = current_setting('teste.p1')::uuid), '(answered,f9000000-0000-0000-0000-000000000004)', 'pergunta respondida');
select is((select asked_count from public.faq_foods where slug = 'pequi'), 2, 'RN-07: "Perguntado por 2 mães"');
select lives_ok($$ select public.faq_publicar('f9000000-0000-0000-0000-000000000001', '{}', 'Nutri Ana', current_date) $$, 'publica o açaí');
select public.faq_publicar('f9000000-0000-0000-0000-000000000002', '{}', 'Nutri Ana', current_date);
select lives_ok($$ select public.faq_rejeitar((select id from public.faq_questions where text like 'Pode tomar chá%'), 'pergunta_medica') $$, 'RN-08: rejeita com motivo');

reset role;
select is((select count(*) from public.avisos where tipo = 'faq_answer' and push_pendente), 2::bigint, 'RN-07: um aviso com push para cada votante');
select is((select count(*) from public.avisos where tipo = 'faq_rejected' and not push_pendente), 1::bigint, 'RN-08: rejeição só na central, sem push');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009a1","role":"authenticated"}';
select is((select name from public.buscar_faq('acai') limit 1), 'Açaí', 'critério: "acai" sem acento acha "Açaí"');
select is((select name from public.buscar_faq('peixe') limit 1), 'Peixe cru (sushi, ceviche)', 'RN-02: trecho do nome também acha') ;
select lives_ok($$ insert into public.faq_favorites (id, food_id) values (gen_random_uuid(), 'f9000000-0000-0000-0000-000000000001') $$, 'RN-10: favoritar');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009b1","role":"authenticated"}';
select is((select count(*) from public.faq_favorites), 0::bigint, 'favoritos de cada um');

select * from finish();
rollback;
