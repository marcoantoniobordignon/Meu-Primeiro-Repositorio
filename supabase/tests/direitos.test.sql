-- Funcionalidade 16 · Direitos da gestante: publicação com base legal e revisão (RN-01), busca em português (RN-04),
-- parceiro só com os cartões dele (RN-07), selo "Atualizado" pelo conteúdo (RN-09), alerta de revisão (RN-02).
begin;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000016a1', 'gestante@teste.dev'),
  ('00000000-0000-0000-0000-0000000016c1', 'parceiro@teste.dev'),
  ('00000000-0000-0000-0000-0000000016e1', 'revisor@teste.dev');
update public.profiles set is_reviewer = true where id = '00000000-0000-0000-0000-0000000016e1';
-- O parceiro sai da família vazia do primeiro login e entra na dela (como no aceite do convite).
delete from public.membros_familia where profile_id = '00000000-0000-0000-0000-0000000016c1';
insert into public.membros_familia (familia_id, profile_id, papel)
  select familia_id, '00000000-0000-0000-0000-0000000016c1', 'parceiro' from public.membros_familia where profile_id = '00000000-0000-0000-0000-0000000016a1';

insert into public.rights_cards (id, slug, topic, question, answer, legal_basis, what_to_do_md, week_from, week_to, applies_to, position) values
  ('d1600000-0000-0000-0000-000000000001', 'estabilidade-gestante', 'work', 'Posso ser demitida durante a gravidez?', 'Sem justa causa, não. A proteção vale mesmo se a empresa não sabia na hora da demissão.', '{"ADCT art. 10, II, b"}', '- Procure o sindicato.', 4, 40, 'mother', 2),
  ('d1600000-0000-0000-0000-000000000002', 'licenca-paternidade', 'work', 'E a licença do pai ou parceiro?', 'A licença-paternidade é de 5 dias, ou 20 na Empresa Cidadã.', '{"CF art. 7º, XIX"}', '- Fale com o RH.', 34, 40, 'both', 8),
  ('d1600000-0000-0000-0000-000000000003', 'acompanhante-no-parto', 'health', 'Posso ter acompanhante no parto?', 'Sim. A lei garante um acompanhante da sua escolha.', '{"Lei 11.108/2005"}', '- Peça para falar com a ouvidoria.', 28, 40, 'both', 3);
select throws_ok($$ update public.rights_cards set status = 'published' where slug = 'estabilidade-gestante' $$, '23514', null, 'RN-01: publicar exige revisor e data');
select throws_ok($$ update public.rights_cards set legal_basis = '{}', status = 'published', reviewed_by = 'Dra. Lia', reviewed_on = current_date where slug = 'acompanhante-no-parto' $$, '23514', null, 'RN-01: publicar exige base legal');
select throws_ok($$ insert into public.rights_cards (slug, topic, question, answer) values ('x', 'work', repeat('a', 91), 'b') $$, '23514', null, 'pergunta até 90');
select throws_ok($$ insert into public.rights_cards (slug, topic, question, answer) values ('y', 'work', 'q', repeat('a', 281)) $$, '23514', null, 'resposta até 280');
select throws_ok($$ insert into public.rights_cards (slug, topic, question, answer) values ('z', 'escola', 'q', 'a') $$, '23514', null, 'tema da lista');
select throws_ok($$ insert into public.help_channels (slug, name, phone) values ('ruim', 'Ruim', '180-1') $$, '23514', null, 'telefone só com dígitos');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000016e1","role":"authenticated"}';
update public.rights_cards set status = 'published', reviewed_by = 'Dra. Lia', reviewed_on = current_date - 400 where slug = 'estabilidade-gestante';
update public.rights_cards set status = 'published', reviewed_by = 'Dra. Lia', reviewed_on = current_date where slug in ('licenca-paternidade', 'acompanhante-no-parto');
select is((select array_agg(slug) from public.direitos_para_revisar()), array['estabilidade-gestante'], 'RN-02: revisado há mais de 12 meses entra no alerta');
insert into public.help_channels (slug, name, phone, description, position) values ('ligue-180', 'Ligue 180', '180', 'Central de Atendimento à Mulher', 1);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000016a1","role":"authenticated"}';
select is((select count(*) from public.rights_cards), 3::bigint, 'a gestante vê todos os publicados');
select is((select slug from public.buscar_direitos('demissão')), 'estabilidade-gestante', 'critério: "demissão" acha o cartão de estabilidade');
select is((select slug from public.buscar_direitos('demitida')), 'estabilidade-gestante', 'RN-04: radical em português ("demitida")');
select is((select count(*) from public.buscar_direitos('acompanhante', 'work')), 0::bigint, 'RN-04: filtro por tema');
select is((select count(*) from public.help_channels), 0::bigint, 'canal só aparece depois de conferido (ativo)');
select throws_ok($$ select * from public.direitos_para_revisar() $$, '42501', null, 'o alerta é só do revisor');
insert into public.rights_favorites (id, card_id) values ('d1600000-0000-0000-0000-0000000000f1', 'd1600000-0000-0000-0000-000000000003');
select is((select count(*) from public.rights_favorites), 1::bigint, 'favoritar');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000016c1","role":"authenticated"}';
select is((select array_agg(slug order by slug) from public.rights_cards), array['acompanhante-no-parto', 'licenca-paternidade'], 'critério: o parceiro vê a licença-paternidade e não os cartões só da gestante');
select is((select count(*) from public.rights_favorites), 0::bigint, 'favoritos são de cada um');

-- RN-09: mudar o texto acende "Atualizado"; renovar só a revisão, não.
reset role;
update public.rights_cards set content_updated_at = '2026-01-01' where slug = 'acompanhante-no-parto';
update public.rights_cards set reviewed_on = current_date where slug = 'acompanhante-no-parto';
select is((select content_updated_at from public.rights_cards where slug = 'acompanhante-no-parto'), '2026-01-01'::timestamptz, 'renovar a revisão não muda o conteúdo');
update public.rights_cards set answer = 'Sim. A lei garante um acompanhante da sua escolha durante o trabalho de parto, o parto e o pós-parto imediato.' where slug = 'acompanhante-no-parto';
select ok((select content_updated_at > now() - interval '1 minute' from public.rights_cards where slug = 'acompanhante-no-parto'), 'RN-09: mudar o texto marca content_updated_at');

select * from finish();
rollback;
