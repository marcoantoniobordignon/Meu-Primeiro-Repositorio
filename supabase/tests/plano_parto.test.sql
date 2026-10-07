-- Funcionalidade 10 · Plano de parto: modelo, um plano por gestação e RN-10 (parceiro marca itens, não edita preferências).
begin;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000010a1', 'gestante@teste.dev'),
  ('00000000-0000-0000-0000-0000000010c1', 'parceiro@teste.dev'),
  ('00000000-0000-0000-0000-0000000010d1', 'baba@teste.dev'),
  ('00000000-0000-0000-0000-0000000010b1', 'outra@teste.dev');
update public.profiles set nome = 'Helena', dpp = current_date + 60, onboarding_concluido_em = now() where id = '00000000-0000-0000-0000-0000000010a1';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000010a1","role":"authenticated"}';

select lives_ok($$ insert into public.birth_plans (id, maternity_name, maternity_phone, prefs) values ('b1000000-0000-0000-0000-000000000001', 'Maternidade Sol', '11 3333-4444', '{"analgesia": "epidural", "skin_to_skin": true}') $$, 'gestante cria o plano');
select is((select (wished_delivery, completed_steps)::text from public.birth_plans), '(undecided,{})', 'padrões: ainda decidindo, nenhuma etapa');
select throws_ok($$ insert into public.birth_plans (id) values (gen_random_uuid()) $$, '23505', null, 'um plano por gestação');
select throws_ok($$ update public.birth_plans set completed_steps = '{1,6}', atualizado_em = now() + interval '1 s' $$, '23514', null, 'etapas só de 1 a 5');
select throws_ok($$ update public.birth_plans set prefs = '{"analgesia": "talvez"}', atualizado_em = now() + interval '1 s' $$, '23514', null, 'analgesia fora da lista');
select throws_ok($$ update public.birth_plans set coverage = 'outro', atualizado_em = now() + interval '1 s' $$, '23514', null, 'cobertura fora da lista');
select throws_ok($$ update public.birth_plans set notes = repeat('a', 1001), atualizado_em = now() + interval '1 s' $$, '23514', null, 'observações até 1000');
select lives_ok($$ update public.birth_plans set completed_steps = '{1,3}', atualizado_em = now() + interval '1 s' $$, 'RN-01: concluir etapa sem exigir campos');

insert into public.birth_checklist_items (id, list, title, position) values
  ('b1000000-0000-0000-0000-000000000011', 'bag_mother', 'Chinelo', 1),
  ('b1000000-0000-0000-0000-000000000012', 'documents', 'Cartão da gestante', 1);
select throws_ok($$ insert into public.birth_checklist_items (id, list, title) values (gen_random_uuid(), 'mala', 'x') $$, '23514', null, 'lista fora da lista');
select lives_ok($$ insert into public.birth_checklist_items (id, list, title) values (gen_random_uuid(), 'baptism', 'Vela') $$, 'RN-14: a lista do batismo usa as mesmas tabelas');
select throws_ok($$ insert into public.birth_checklist_items (id, list, title) values (gen_random_uuid(), 'bag_baby', '  ') $$, '23514', null, 'item com título');
select throws_ok($$ insert into public.birth_checklist_items (id, list, title, quantity) values (gen_random_uuid(), 'bag_baby', 'Body', 0) $$, '23514', null, 'quantidade de 1 a 99');

insert into public.birth_item_attachments (id, item_id, storage_path, position) values ('b1000000-0000-0000-0000-000000000021', 'b1000000-0000-0000-0000-000000000012', 'plano/b12/a1.jpg', 1);
select throws_ok($$ insert into public.birth_item_attachments (id, item_id, storage_path, position) values (gen_random_uuid(), 'b1000000-0000-0000-0000-000000000012', 'plano/b12/a4.jpg', 4) $$, '23514', null, 'RN-09: até 3 por item');
select throws_ok($$ insert into public.birth_item_attachments (id, item_id, storage_path, position) values (gen_random_uuid(), 'b1000000-0000-0000-0000-000000000012', 'plano/b12/outra.jpg', 1) $$, '23505', null, 'uma foto por posição');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('ninho-privado', 'plano/b12/a1.jpg', auth.uid()::text) $$, 'Storage: autora sobe o anexo');

-- Parceiro e cuidadora entram.
select set_config('teste.convite', (public.criar_convite_parceiro())::text, true);
select set_config('teste.cuid', public.criar_convite('cuidador'), true);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000010c1","role":"authenticated"}';
select public.aceitar_convite_parceiro(current_setting('teste.convite')::jsonb ->> 'token');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000010d1","role":"authenticated"}';
select public.aceitar_convite(current_setting('teste.cuid'), 'Babá');

-- RN-10: o parceiro vê tudo, marca e adiciona itens; não altera preferências nem contatos.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000010c1","role":"authenticated"}';
select is((select maternity_name from public.birth_plans), 'Maternidade Sol', 'RN-10: parceiro lê o plano');
select is((select count(*) from public.birth_item_attachments), 1::bigint, 'RN-10: e os anexos');
select lives_ok($$ update public.birth_checklist_items set is_done = true, atualizado_em = now() + interval '1 s' where id = 'b1000000-0000-0000-0000-000000000011' $$, 'RN-10: parceiro marca item da mala');
select lives_ok($$ insert into public.birth_checklist_items (id, list, title, is_custom, position) values ('b1000000-0000-0000-0000-000000000013', 'bag_mother', 'Almofada de amamentação', true, 2) $$, 'RN-10: parceiro adiciona item');
update public.birth_plans set maternity_phone = '0000', prefs = '{}', atualizado_em = now() + interval '1 minute';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000010a1","role":"authenticated"}';
select is((select (maternity_phone, prefs ->> 'analgesia')::text from public.birth_plans), '("11 3333-4444",epidural)', 'RN-10: parceiro não altera preferências nem contatos');
select is((select is_done from public.birth_checklist_items where id = 'b1000000-0000-0000-0000-000000000011'), true, 'critério: ela vê o item marcado por ele');

-- Permissão desligada nega na hora.
select public.definir_permissoes_parceiro('00000000-0000-0000-0000-0000000010c1', '{"birth_plan": false}');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000010c1","role":"authenticated"}';
select is((select count(*) from public.birth_plans) + (select count(*) from public.birth_checklist_items), 0::bigint, 'sem birth_plan, nada do plano');

-- Cuidadora e outra família: nada.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000010d1","role":"authenticated"}';
select is((select count(*) from public.birth_plans) + (select count(*) from public.birth_checklist_items), 0::bigint, 'cuidadora não vê o plano');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000010b1","role":"authenticated"}';
select is((select count(*) from public.birth_plans) + (select count(*) from public.birth_checklist_items) + (select count(*) from storage.objects), 0::bigint, 'outra família não lê nada');

select * from finish();
rollback;
