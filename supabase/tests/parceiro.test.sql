-- Funcionalidade 12 · Modo parceiro: convite (RN-01/02/03/12), matriz de acesso por RLS (RN-04/05) e saída (RN-06).
begin;
select plan(47);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000001a1', 'gestante@teste.dev', false),
  ('00000000-0000-0000-0000-0000000001b1', 'outra-gestante@teste.dev', false),
  ('00000000-0000-0000-0000-0000000001c1', 'parceiro@teste.dev', false),
  ('00000000-0000-0000-0000-0000000001d1', null, true),
  ('00000000-0000-0000-0000-0000000001e1', 'segundo@teste.dev', false);
update public.profiles set nome = 'Helena', dpp = current_date + 140, onboarding_concluido_em = now() where id = '00000000-0000-0000-0000-0000000001a1';
update public.profiles set nome = 'Bia', dpp = current_date + 100, onboarding_concluido_em = now() where id = '00000000-0000-0000-0000-0000000001b1';
update public.profiles set nome = 'Rafa' where id = '00000000-0000-0000-0000-0000000001c1';
insert into public.partner_tips (week_from, week_to, trimester, feeling_text, help_tips) values (20, 20, 2, 'Ela pode estar com mais energia.', '{"Vá junto ao morfológico."}');

set local role authenticated;

-- A gestante registra coisas que o parceiro não pode ver e outras que pode.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}';
insert into public.appointments (id, starts_at, provider_name, location) values ('b1000000-0000-0000-0000-000000000001', now() + interval '2 days', 'Dra. Ana', 'Clínica Sol');
insert into public.appointment_measures (id, appointment_id, weight_kg, notes_after) values ('b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 70, 'repouso');
insert into public.medications (id, name, schedule_type, times, starts_on, color_key) values ('a1000000-0000-0000-0000-000000000001', 'Ferro', 'fixed_times', '{08:00}', current_date, 'primaria');
insert into public.user_exams (id, catalog_code, status, scheduled_at, notes, location, window_start_date, window_end_date) values
  ('c1000000-0000-0000-0000-000000000011', 'morpho', 'scheduled', now() + interval '5 days', 'jejum', 'Lab Vida', current_date, current_date + 20),
  ('c1000000-0000-0000-0000-000000000012', 'blood_1', 'done', null, null, null, current_date - 30, current_date - 10);

-- RN-01: só a gestante; token de 32 bytes; código de 6 sem ambíguos; 7 dias.
select set_config('teste.c1', (public.criar_convite_parceiro())::text, true);
select is(length(current_setting('teste.c1')::jsonb ->> 'token'), 64, 'RN-01: token de 32 bytes');
select matches(current_setting('teste.c1')::jsonb ->> 'code', '^[A-HJ-NP-Z2-9]{6}$', 'RN-01: código de 6 sem ambíguos');
select ok((current_setting('teste.c1')::jsonb ->> 'expires_at')::timestamptz between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute', 'RN-01: validade de 7 dias');
select is((select count(*) from public.partner_invites where token_hash = current_setting('teste.c1')::jsonb ->> 'token'), 0::bigint, 'RN-01: o token em si nunca é guardado');

-- Gerar outro revoga o anterior.
select set_config('teste.c2', (public.criar_convite_parceiro())::text, true);
select is((public.convite_parceiro_publico(current_setting('teste.c1')::jsonb ->> 'token') ->> 'estado'), 'revogado', 'RN-01: gerar outro revoga o anterior');
select is((select count(*) from public.partner_invites where accepted_at is null and revoked_at is null), 1::bigint, 'RN-01: um convite ativo por vez');
select is(public.convite_parceiro_publico(null, current_setting('teste.c2')::jsonb ->> 'code'), '{"estado": "valido", "quem": "Helena"}'::jsonb, 'tela 2: só o nome de quem convidou');

-- RN-02: aceitar exige login; uma conta, um papel.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001d1","role":"authenticated","is_anonymous":true}';
select throws_ok($$ select public.aceitar_convite_parceiro(current_setting('teste.c2')::jsonb ->> 'token') $$, 'P0001', 'precisa_login', 'RN-02: anônimo precisa entrar');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001b1","role":"authenticated"}';
select throws_ok($$ select public.aceitar_convite_parceiro(current_setting('teste.c2')::jsonb ->> 'token') $$, 'P0001', 'outra_conta', 'RN-02: quem tem gestação própria usa outra conta');
select lives_ok($$ select public.criar_convite_parceiro() $$, 'outra gestante, sem parceiro, convida o dela');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001c1","role":"authenticated"}';
select set_config('teste.familia_c', (select familia_id::text from public.membros_familia where profile_id = auth.uid()), true);
select throws_ok($$ select public.revogar_convite_parceiro(); select public.definir_permissoes_parceiro(auth.uid(), '{}') $$, 'P0001', 'parceiro não encontrado', 'só mexe em permissão de parceiro que existe');
insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.teste/rafa', 'k', 'a');
select ok((public.aceitar_convite_parceiro(null, lower(substr(current_setting('teste.c2')::jsonb ->> 'code', 1, 3)) || '-' || substr(current_setting('teste.c2')::jsonb ->> 'code', 4), 'Rafa') ->> 'horas')::numeric >= 0, 'RN-10: aceita pelo código digitado (minúsculas e hífen valem)');
select is(public.papel_do_usuario(), 'parceiro', 'entrou como parceiro');
select is((select count(*) from public.familias where id = current_setting('teste.familia_c')::uuid), 0::bigint, 'a família vazia do primeiro login sai');
select throws_ok($$ select public.aceitar_convite_parceiro(current_setting('teste.c2')::jsonb ->> 'token') $$, 'P0001', 'usado', 'convite vale uma vez');

-- RN-03: um parceiro por gestação.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}';
select throws_ok($$ select public.criar_convite_parceiro() $$, 'P0001', 'ja_tem_parceiro', 'RN-03: com parceiro ativo, nada de convite novo');
select is((select public.estado_convite_parceiro(i) from public.partner_invites i where accepted_at is not null), 'usado', 'convite aceito vira usado');

-- RN-04: a matriz aplicada por RLS.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001c1","role":"authenticated"}';
select is((select dpp from public.minha_familia()), current_date + 140, 'a semana dele é a dela (DPP da gestante)');
select is((select count(*) from public.appointments), 1::bigint, 'consultas: lê (agenda)');
select is((select count(*) from public.appointment_measures), 0::bigint, 'medidas e notes_after: nunca');
select is((select count(*) from public.medications), 0::bigint, 'medicamentos: nunca');
select is((select count(*) from public.user_exams), 0::bigint, 'exames: nunca pela tabela');
select is((select count(*) from public.exames_marcados_parceiro()), 1::bigint, 'exames marcados: só o marcado, nunca o feito');
select is((select row(catalog_code, custom_name)::text from public.exames_marcados_parceiro()), '(morpho,)', 'exames marcados: só nome e data (sem local nem observação)');
select is((select count(*) from public.partner_invites), 0::bigint, 'o parceiro não vê os convites');
select ok(public.tem_permissao((select familia_id from public.minha_familia()), 'birth_plan'), 'birth_plan ligado por padrão');
select ok(not public.tem_permissao((select familia_id from public.minha_familia()), 'belly_photos'), 'fotos desligadas por padrão');
select lives_ok($$ insert into public.appointment_questions (id, text) values ('b1000000-0000-0000-0000-000000000002', 'Posso viajar?') $$, 'ele anota pergunta na pauta');
insert into public.diary_entries (id, kind, body) values ('e1000000-0000-0000-0000-000000000001', 'free', 'Ouvi o coração');
select is((select count(*) from public.partner_tips), 1::bigint, '"Como ajudar" é legível');

-- RN-05: mudar permissão vale na hora.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}';
select public.definir_permissoes_parceiro('00000000-0000-0000-0000-0000000001c1', '{"agenda": false}');
select is((select permissoes from public.meus_membros() where papel = 'parceiro'), '{"agenda": false, "birth_plan": true, "belly_photos": false}'::jsonb, 'permissões guardadas com os padrões');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001c1","role":"authenticated"}';
select is((select count(*) from public.appointments) + (select count(*) from public.exames_marcados_parceiro()), 0::bigint, 'RN-05: agenda desligada nega na hora');
select throws_ok($$ insert into public.appointment_questions (id, text) values (gen_random_uuid(), 'E agora?') $$, '42501', null, 'RN-05: e nega a escrita também');

-- RN-06: ele sai; o diário fica com ela, com o nome; push apagado; aviso na central dela.
select lives_ok($$ select public.sair_da_gestacao() $$, 'parceiro sai');
select is(public.papel_do_usuario(), 'mae', 'volta a ter uma família só dele');
select is((select count(*) from public.diary_entries), 0::bigint, 'RN-06: acesso encerrado');
select is((select count(*) from public.push_subscriptions), 0::bigint, 'RN-06: push dele apagado');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}';
select is((select body from public.diary_entries where id = 'e1000000-0000-0000-0000-000000000001'), 'Ouvi o coração', 'RN-06: o diário dele continua com ela');
select is((select nome from public.meus_membros() where profile_id = '00000000-0000-0000-0000-0000000001c1' and removido_em is not null), 'Rafa', 'RN-06: com o nome, para o "Escrito por"');
select is((select tipo from public.avisos), 'partner_left', 'RN-06: aviso na central dela');

-- Ela convida de novo; ele volta (a mesma linha reativada); ela remove.
select set_config('teste.c3', (public.criar_convite_parceiro())::text, true);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001c1","role":"authenticated"}';
select lives_ok($$ select public.aceitar_convite_parceiro(current_setting('teste.c3')::jsonb ->> 'token') $$, 'volta com convite novo');
select is((select permissoes from public.meus_membros() where papel = 'parceiro'), '{"agenda": true, "birth_plan": true, "belly_photos": false}'::jsonb, 'volta com as permissões padrão');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}';
select lives_ok($$ select public.remover_membro('00000000-0000-0000-0000-0000000001c1') $$, 'gestante remove');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001c1","role":"authenticated"}';
select is((select count(*) from public.appointments), 0::bigint, 'RN-06: removido perde o acesso na hora');
select is((select count(*) from public.avisos), 0::bigint, 'avisos dela não aparecem para ele');

-- RN-12: convite vencido.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}';
select set_config('teste.c4', (public.criar_convite_parceiro())::text, true);
reset role;
update public.partner_invites set expires_at = now() - interval '1 minute', criado_em = now() - interval '8 days' where accepted_at is null and revoked_at is null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001e1","role":"authenticated"}';
select is(public.convite_parceiro_publico(current_setting('teste.c4')::jsonb ->> 'token') ->> 'estado', 'expirado', 'RN-12: convite com mais de 7 dias está expirado');
select throws_ok($$ select public.aceitar_convite_parceiro(current_setting('teste.c4')::jsonb ->> 'token') $$, 'P0001', 'expirado', 'RN-12: e não entra');
select is(public.convite_parceiro_publico('nao-existe') ->> 'estado', 'inexistente', 'RN-12: link errado');

select * from finish();
rollback;
