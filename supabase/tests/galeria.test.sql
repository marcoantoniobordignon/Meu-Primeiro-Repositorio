-- Funcionalidade 01 · Galeria de exames e ultrassons: modelo, RLS (RN-10), Storage, cota e faxina (RN-03/08/09).
begin;
select plan(43);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'gestante@teste.dev'),
  ('00000000-0000-0000-0000-0000000000b1', 'outra@teste.dev'),
  ('00000000-0000-0000-0000-0000000000c1', 'parceiro@teste.dev'),
  ('00000000-0000-0000-0000-0000000000d1', 'baba@teste.dev');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select is((select consents from public.profiles where id = auth.uid()), '{}'::jsonb, 'RN-05: consentimento começa vazio');

insert into public.user_exams (id, catalog_code, status, scheduled_at, window_start_date, window_end_date)
  values ('c1000000-0000-0000-0000-000000000001', 'morpho', 'scheduled', now() - interval '1 day', current_date - 10, current_date + 10);
insert into public.medical_documents (id, kind, exam_date, title) values ('f1000000-0000-0000-0000-000000000001', 'us_morpho', current_date, 'Morfológico');
insert into public.medical_documents (id, kind, exam_date) values ('f1000000-0000-0000-0000-000000000002', 'blood', current_date - 30);
insert into public.document_pages (id, document_id, position, storage_path, mime, bytes, width, height) values
  ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 1, 'documentos/f1/p1.jpg', 'image/jpeg', 300000, 1500, 2000),
  ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 2, 'documentos/f1/p2.jpg', 'image/jpeg', 300000, 1500, 2000),
  ('f2000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000002', 1, 'documentos/f2/p1.jpg', 'image/jpeg', 200000, 1500, 2000);

select is((select familia_id is not null and criado_por = auth.uid() from public.medical_documents where id = 'f1000000-0000-0000-0000-000000000001'), true, 'família e autora preenchidas pela sessão');
select is((select familia_id is not null from public.document_pages where id = 'f2000000-0000-0000-0000-000000000001'), true, 'página na família');
select is((select (ai_status, is_favorite, shared_with_partner)::text from public.medical_documents where id = 'f1000000-0000-0000-0000-000000000002'), '(none,f,f)', 'RN-10: começa sem compartilhar; IA em none');

-- RN-01 e limites do modelo
select throws_ok($$ insert into public.medical_documents (id, kind, exam_date) values (gen_random_uuid(), 'raio_x', current_date) $$, '23514', null, 'tipo fora da lista');
select throws_ok($$ insert into public.medical_documents (id, kind) values (gen_random_uuid(), 'blood') $$, '23502', null, 'RN-01: data obrigatória');
select throws_ok($$ insert into public.medical_documents (id, exam_date) values (gen_random_uuid(), current_date) $$, '23502', null, 'RN-01: tipo obrigatório');
select throws_ok($$ insert into public.medical_documents (id, kind, exam_date) values (gen_random_uuid(), 'blood', current_date + 3) $$, '23514', null, 'RN-01: data futura');
select throws_ok($$ insert into public.medical_documents (id, kind, exam_date, title) values (gen_random_uuid(), 'blood', current_date, repeat('a', 81)) $$, '23514', null, 'título até 80');
select throws_ok($$ insert into public.medical_documents (id, kind, exam_date, notes) values (gen_random_uuid(), 'blood', current_date, repeat('a', 1001)) $$, '23514', null, 'observação até 1000');
select throws_ok($$ insert into public.medical_documents (id, kind, exam_date, is_favorite) values (gen_random_uuid(), 'blood', current_date, true) $$, '23514', null, 'RN-12: favoritar só ultrassom');
select lives_ok($$ update public.medical_documents set is_favorite = true, atualizado_em = now() + interval '1 second' where id = 'f1000000-0000-0000-0000-000000000001' $$, 'RN-12: ultrassom favorita');
select throws_ok($$ insert into public.medical_documents (id, kind, exam_date, ai_status) values (gen_random_uuid(), 'blood', current_date, 'lendo') $$, '23514', null, 'ai_status fora da lista');
select throws_ok($$ insert into public.document_pages (id, document_id, position, storage_path, mime, bytes) values (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000001', 21, 'x.jpg', 'image/jpeg', 10) $$, '23514', null, 'até 20 páginas por documento');
select throws_ok($$ insert into public.document_pages (id, document_id, position, storage_path, mime, bytes) values (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000001', 3, 'x.jpg', 'image/jpeg', 15728641) $$, '23514', null, '15 MB por arquivo');

-- ARQ-02 e o vínculo com o exame (spec 03)
update public.medical_documents set title = 'antigo', atualizado_em = now() - interval '1 day' where id = 'f1000000-0000-0000-0000-000000000001';
select is((select title from public.medical_documents where id = 'f1000000-0000-0000-0000-000000000001'), 'Morfológico', 'ARQ-02: escrita antiga não sobrescreve');
select lives_ok($$ update public.user_exams set status = 'done', done_on = current_date, document_id = 'f1000000-0000-0000-0000-000000000001', atualizado_em = now() + interval '1 second' where id = 'c1000000-0000-0000-0000-000000000001' $$, 'RN-04: exame vinculado ao documento');
select throws_ok($$ update public.user_exams set document_id = gen_random_uuid(), atualizado_em = now() + interval '2 second' where id = 'c1000000-0000-0000-0000-000000000001' $$, '23503', null, 'FK do exame para o documento');

-- Storage das páginas e da exportação (RN-09)
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('ninho-privado', 'documentos/f1/p1.jpg', auth.uid()::text) $$, 'autora sobe a página');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('ninho-privado', 'documentos/f2/p1.jpg', auth.uid()::text) $$, 'autora sobe a página do outro documento');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('ninho-privado', 'exportacoes/00000000-0000-0000-0000-0000000000a1/x.pdf', auth.uid()::text) $$, 'RN-09: PDF na própria pasta');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('ninho-privado', 'exportacoes/00000000-0000-0000-0000-0000000000b1/x.pdf', auth.uid()::text) $$, '42501', null, 'RN-09: nunca na pasta de outra pessoa');

-- RN-08: a cota só a service role escreve.
select is((select count(*) from public.ai_document_reads), 0::bigint, 'cota invisível para o app');
select throws_ok($$ insert into public.ai_document_reads (familia_id, ok) select familia_id, true from public.medical_documents limit 1 $$, '42501', null, 'app não mexe na cota');
select throws_ok($$ select public.limpar_documentos_excluidos() $$, '42501', null, 'RN-03: faxina só pelo job');
select throws_ok($$ select public.exportacoes_vencidas() $$, '42501', null, 'RN-09: faxina só pelo job');

-- Parceiro e cuidadora entram.
select set_config('teste.parceiro', public.criar_convite('parceiro'), true);
select set_config('teste.cuidador', public.criar_convite('cuidador'), true);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select public.aceitar_convite(current_setting('teste.parceiro'), 'Rafa');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select public.aceitar_convite(current_setting('teste.cuidador'), 'Babá');

-- RN-10: sem compartilhar, o parceiro não vê nada.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is((select count(*) from public.medical_documents), 0::bigint, 'RN-10: parceiro não vê o que não foi compartilhado');
select is((select count(*) from public.document_pages), 0::bigint, 'RN-10: nem as páginas');
select is((select count(*) from storage.objects where name like 'documentos/%'), 0::bigint, 'RN-10: nem os arquivos');
select throws_ok($$ insert into public.medical_documents (id, kind, exam_date) values (gen_random_uuid(), 'blood', current_date) $$, '42501', null, 'parceiro não guarda documento');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
update public.medical_documents set shared_with_partner = true, atualizado_em = now() + interval '5 second' where id = 'f1000000-0000-0000-0000-000000000001';

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is((select count(*) from public.medical_documents), 1::bigint, 'RN-10: parceiro vê o compartilhado');
select is((select count(*) from public.document_pages), 2::bigint, 'RN-10: com as páginas dele');
select is((select count(*) from storage.objects where name like 'documentos/%'), 1::bigint, 'RN-10: e só os arquivos dele');
update public.medical_documents set title = 'mexi', atualizado_em = now() + interval '1 minute' where id = 'f1000000-0000-0000-0000-000000000001';
select is((select title from public.medical_documents where id = 'f1000000-0000-0000-0000-000000000001'), 'Morfológico', 'parceiro não edita');
select is((select count(*) from storage.objects where name like 'exportacoes/%'), 0::bigint, 'RN-09: parceiro não lê a exportação dela');

-- Cuidadora e outra família: nada.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*) from public.medical_documents) + (select count(*) from public.document_pages), 0::bigint, 'cuidadora não vê a galeria, nem o compartilhado');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((select count(*) from public.medical_documents) + (select count(*) from public.document_pages) + (select count(*) from storage.objects), 0::bigint, 'outra família não lê nada');

-- RN-03: a gestante exclui; o job esvazia o conteúdo e devolve os arquivos a remover.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
update public.medical_documents set apagado_em = now(), atualizado_em = now() + interval '10 second' where id = 'f1000000-0000-0000-0000-000000000002';
update public.document_pages set apagado_em = now(), atualizado_em = now() + interval '10 second' where id = 'f2000000-0000-0000-0000-000000000002';
select is((select count(*) from public.medical_documents where apagado_em is null), 1::bigint, 'excluído sai da galeria');

reset role;
update storage.objects set created_at = now() - interval '25 hours' where name like 'exportacoes/%';
insert into storage.objects (bucket_id, name, owner_id, created_at) values ('ninho-privado', 'exportacoes/00000000-0000-0000-0000-0000000000a1/novo.pdf', '00000000-0000-0000-0000-0000000000a1', now());
select set_eq($$ select caminho from public.limpar_documentos_excluidos() $$, array['documentos/f2/p1.jpg', 'documentos/f1/p2.jpg'], 'RN-03: devolve os arquivos do excluído e da página removida');
select is((select (title, notes, ai_summary, ai_status)::text from public.medical_documents where id = 'f1000000-0000-0000-0000-000000000002'), '(,,,none)', 'RN-03: conteúdo do excluído apagado');
select is((select title from public.medical_documents where id = 'f1000000-0000-0000-0000-000000000001'), 'Morfológico', 'o documento vivo não é tocado');
select is((select count(*) from public.document_pages), 3::bigint, 'as linhas das páginas ficam até o Storage confirmar');
select set_eq($$ select caminho from public.exportacoes_vencidas() $$, array['exportacoes/00000000-0000-0000-0000-0000000000a1/x.pdf'], 'RN-09: só o PDF com mais de 24 h vence');

select * from finish();
rollback;
