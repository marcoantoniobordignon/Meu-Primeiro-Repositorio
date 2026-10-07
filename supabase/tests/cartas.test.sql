-- Funcionalidade 14 · Cartas para o bebê: lacre no banco (RN-03), regras de abertura (RN-02), limites do plano
-- (RN-07), cada autor com as suas (RN-09), desfazer o lacre (RN-04), link de leitura (RN-06), exclusão (RN-08) e Storage.
begin;
select plan(42);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000014a1', 'gestante@teste.dev'),
  ('00000000-0000-0000-0000-0000000014c1', 'parceiro@teste.dev'),
  ('00000000-0000-0000-0000-0000000014d1', 'outra@teste.dev');
update public.profiles set dpp = '2027-03-08', tz = 'America/Sao_Paulo' where id = '00000000-0000-0000-0000-0000000014a1';
delete from public.membros_familia where profile_id = '00000000-0000-0000-0000-0000000014c1';
insert into public.membros_familia (familia_id, profile_id, papel)
  select familia_id, '00000000-0000-0000-0000-0000000014c1', 'parceiro' from public.membros_familia where profile_id = '00000000-0000-0000-0000-0000000014a1';
select set_config('teste.familia', (select familia_id::text from public.membros_familia where profile_id = '00000000-0000-0000-0000-0000000014a1'), true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000014a1","role":"authenticated"}';
select lives_ok($$ select public.salvar_carta('{"id":"c1400000-0000-0000-0000-000000000001","title":"Para você","body":"Te espero com amor.","open_rule":"first_birthday","atualizado_em":"2026-10-07T10:00:00Z"}') $$, 'rascunho pela função');
select is((select body from public.letters_visible where id = 'c1400000-0000-0000-0000-000000000001'), 'Te espero com amor.', 'rascunho: a autora lê');
select throws_ok($$ select * from public.letters $$, '42501', null, 'RN-03: a tabela não é lida direto');
select throws_ok($$ insert into public.letters (id, familia_id, author_id, title) values (gen_random_uuid(), current_setting('teste.familia')::uuid, auth.uid(), 'x') $$, '42501', null, 'nem escrita direto');
select throws_ok($$ select public.salvar_carta('{"id":"c1400000-0000-0000-0000-0000000000ff","title":"","body":"x"}') $$, '23514', null, 'RN-01: título obrigatório');
select throws_ok($$ select public.salvar_carta(jsonb_build_object('id', 'c1400000-0000-0000-0000-0000000000fe', 'title', 't', 'body', repeat('a', 5001))) $$, '23514', null, 'texto até 5000');
-- Versão velha (fila fora de ordem) não pisa na nova.
select public.salvar_carta('{"id":"c1400000-0000-0000-0000-000000000001","title":"Antiga","body":"x","atualizado_em":"2026-10-07T09:00:00Z"}');
select is((select title from public.letters_visible where id = 'c1400000-0000-0000-0000-000000000001'), 'Para você', 'versão mais velha é ignorada');

-- RN-07: free, só texto e 2 por autor.
select throws_ok($$ select public.salvar_carta('{"id":"c1400000-0000-0000-0000-000000000002","title":"Com voz","audio_path":"cartas/c1400000-0000-0000-0000-000000000002/a.webm","audio_seconds":30}') $$, 'P0001', 'premium', 'RN-07: áudio é do Completo');
select lives_ok($$ select public.salvar_carta('{"id":"c1400000-0000-0000-0000-000000000002","title":"Só título"}') $$, 'segunda carta');
select throws_ok($$ select public.salvar_carta('{"id":"c1400000-0000-0000-0000-000000000003","title":"Terceira","body":"x"}') $$, 'P0001', 'limite_cartas', 'critério: no free, a 3ª carta não entra');

-- RN-01/02/03: lacrar.
select throws_ok($$ select public.lacrar_carta('c1400000-0000-0000-0000-000000000002', '2026-01-01') $$, 'P0001', 'sem_conteudo', 'RN-01: sem texto nem áudio não lacra');
select throws_ok($$ select public.lacrar_carta('c1400000-0000-0000-0000-000000000001', '2026-10-08T00:00:00Z') $$, 'P0001', 'nao_sincronizado', 'lacrar exige a versão do aparelho no servidor');
select is(public.lacrar_carta('c1400000-0000-0000-0000-000000000001', '2026-10-07T10:00:00Z'), '2028-03-08'::date, 'RN-02: 1º aniversário pela DPP, antes do nascimento');
select is((select (status, body, audio_path, title, open_on)::text from public.letters_visible where id = 'c1400000-0000-0000-0000-000000000001'), '(sealed,,,"Para você",2028-03-08)', 'critério: lacrada mostra só título e data, nem na API');
select throws_ok($$ select public.salvar_carta(jsonb_build_object('id', 'c1400000-0000-0000-0000-000000000001', 'title', 'Mudei', 'body', 'y', 'atualizado_em', now() + interval '1 hour')) $$, 'P0001', 'carta_lacrada', 'RN-03: lacrada não muda');
select public.salvar_carta('{"id":"c1400000-0000-0000-0000-000000000001","title":"Fila velha","body":"y","atualizado_em":"2026-10-07T11:00:00Z"}');
select is((select title from public.letters_visible where id = 'c1400000-0000-0000-0000-000000000001'), 'Para você', 'edição velha que chega depois do lacre é ignorada (a fila não trava)');
select throws_ok($$ select public.lacrar_carta('c1400000-0000-0000-0000-000000000001', '2026-01-01') $$, 'P0001', 'carta_lacrada', 'não lacra duas vezes');

-- RN-09: o parceiro (e qualquer outra pessoa) não vê as cartas dela.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000014c1","role":"authenticated"}';
select is((select count(*) from public.letters_visible), 0::bigint, 'RN-09: o parceiro não vê as cartas dela');
select throws_ok($$ select public.deslacrar_carta('c1400000-0000-0000-0000-000000000001') $$, 'P0001', 'carta_nao_lacrada', 'nem desfaz o lacre dela');
select lives_ok($$ select public.salvar_carta('{"id":"c1400000-0000-0000-0000-0000000000c1","title":"Do pai","body":"Oi, filho."}') $$, 'o parceiro escreve as dele');
select throws_ok($$ select public.salvar_carta('{"id":"c1400000-0000-0000-0000-000000000002","title":"Invadi"}') $$, '42501', null, 'e não escreve nas dela');

-- RN-04: desfazer o lacre devolve o conteúdo e volta a rascunho.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000014a1","role":"authenticated"}';
select is((select (status, body, open_on)::text from public.deslacrar_carta('c1400000-0000-0000-0000-000000000001')), '(draft,"Te espero com amor.",)', 'critério: desfazer o lacre volta a rascunho com o texto');
select isnt((select unsealed_at from public.letters_visible where id = 'c1400000-0000-0000-0000-000000000001'), null, 'RN-04: unsealed_at gravado');

-- RN-02: data própria entre hoje + 180 dias e hoje + 30 anos.
select public.salvar_carta(jsonb_build_object('id', 'c1400000-0000-0000-0000-000000000002', 'title', 'Daqui a pouco', 'body', 'x', 'open_rule', 'custom', 'custom_open_on', current_date + 10, 'atualizado_em', now()));
select throws_ok($$ select public.lacrar_carta('c1400000-0000-0000-0000-000000000002', '2020-01-01') $$, 'P0001', 'data_invalida', 'RN-02: data própria antes de 180 dias não vale');
select public.salvar_carta(jsonb_build_object('id', 'c1400000-0000-0000-0000-000000000002', 'title', 'Daqui a um ano', 'body', 'x', 'open_rule', 'custom', 'custom_open_on', current_date + 365, 'atualizado_em', now() + interval '1 second'));
select is(public.lacrar_carta('c1400000-0000-0000-0000-000000000002', '2020-01-01'), current_date + 365, 'data própria válida');
select public.lacrar_carta('c1400000-0000-0000-0000-000000000001', '2020-01-01');

-- RN-02: registrar o nascimento recalcula a data das lacradas por regra (não a própria).
reset role;
insert into public.bebes (id, familia_id, nome, nascido_em) values ('b1400000-0000-0000-0000-000000000001', current_setting('teste.familia')::uuid, 'Theo', '2027-02-20 15:00:00-03');
select is((select open_on from public.letters where id = 'c1400000-0000-0000-0000-000000000001'), '2028-02-20'::date, 'critério: registro o nascimento e o 1º aniversário é recalculado');
select is((select open_on from public.letters where id = 'c1400000-0000-0000-0000-000000000002'), current_date + 365, 'a data própria não muda');
select is(public.data_de_abertura('age_18', '2028-02-29', null), '2046-02-28'::date, '29 de fevereiro vira 28 em ano comum');

-- RN-06: link de leitura só de carta aberta; 30 dias; revogável.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000014a1","role":"authenticated"}';
select throws_ok($$ select public.criar_link_carta('c1400000-0000-0000-0000-000000000001') $$, 'P0001', 'carta_nao_aberta', 'lacrada não gera link');
reset role;
update public.letters set status = 'opened', opened_at = now() where id = 'c1400000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000014a1","role":"authenticated"}';
select is((select body from public.letters_visible where id = 'c1400000-0000-0000-0000-000000000001'), 'Te espero com amor.', 'critério: no dia da abertura, consigo ler');
select set_config('teste.token', public.criar_link_carta('c1400000-0000-0000-0000-000000000001'), true);
select is(length(current_setting('teste.token')), 64, 'RN-06: token de 32 bytes');
reset role;
select is((select count(*) from public.letter_share_tokens where token_hash = current_setting('teste.token')), 0::bigint, 'RN-06: só o hash fica guardado');
set local role service_role;
select is((select (title, body)::text from public.carta_por_token(current_setting('teste.token'))), '("Para você","Te espero com amor.")', 'critério: abro o link e leio');
reset role;
select is((select views from public.letter_share_tokens where expires_at > now() + interval '29 days'), 1, 'conta a leitura; vale 30 dias');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000014a1","role":"authenticated"}';
select public.revogar_link_carta('c1400000-0000-0000-0000-000000000001');
set local role service_role;
select is((select count(*) from public.carta_por_token(current_setting('teste.token'))), 0::bigint, 'critério: revogo e o link para de funcionar');
select is((select count(*) from public.carta_por_token('nao-existe')), 0::bigint, 'token inventado não lê nada');

-- Storage e RN-07 no Completo: áudio só depois de subir; lacrada nem a autora lê o arquivo.
reset role;
update public.familias set plano = 'ativo' where id = current_setting('teste.familia')::uuid;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000014a1","role":"authenticated"}';
select public.salvar_carta('{"id":"c1400000-0000-0000-0000-000000000003","title":"Com voz","audio_path":"cartas/c1400000-0000-0000-0000-000000000003/a.webm","audio_seconds":40,"open_rule":"age_5"}');
select ok(public.arquivo_gravavel('cartas/c1400000-0000-0000-0000-000000000003/a.webm'), 'a autora sobe o áudio do rascunho');
select throws_ok($$ select public.lacrar_carta('c1400000-0000-0000-0000-000000000003', '2020-01-01') $$, 'P0001', 'arquivo_pendente', 'não lacra com o áudio ainda no aparelho');
reset role;
insert into storage.buckets (id, name) values ('ninho-privado', 'ninho-privado') on conflict do nothing;
insert into storage.objects (bucket_id, name) values ('ninho-privado', 'cartas/c1400000-0000-0000-0000-000000000003/a.webm');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000014a1","role":"authenticated"}';
select lives_ok($$ select public.lacrar_carta('c1400000-0000-0000-0000-000000000003', '2020-01-01') $$, 'com o áudio no Storage, lacra');
select ok(not public.arquivo_visivel('cartas/c1400000-0000-0000-0000-000000000003/a.webm'), 'RN-03: lacrada, nem a autora baixa o áudio');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000014c1","role":"authenticated"}';
select ok(not public.arquivo_gravavel('cartas/c1400000-0000-0000-0000-000000000003/a.webm'), 'outra pessoa não sobe arquivo na carta');

-- RN-08: excluir lacrada sem ler; conteúdo some, o Storage fica para o job.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000014a1","role":"authenticated"}';
select public.salvar_carta('{"id":"c1400000-0000-0000-0000-000000000003","apagado_em":"2026-10-07T12:00:00Z"}');
reset role;
select is((select (apagado_em is not null, body, storage_cleanup_pending)::text from public.letters where id = 'c1400000-0000-0000-0000-000000000003'), '(t,,t)', 'RN-08: excluída, sem conteúdo, Storage na fila do job');

select * from finish();
rollback;
