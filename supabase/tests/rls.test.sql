-- Teste de RLS (spec 01 / spec 12): rode com `supabase test db`.
-- Cria duas famílias e confere que uma não lê a outra, e que cuidador não lê sintomas.
begin;
select plan(6);

-- Usuários de teste (o trigger handle_new_user cria perfil, família e membro 'mae').
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'helena@teste.dev'),
  ('00000000-0000-0000-0000-000000000002', 'outra@teste.dev'),
  ('00000000-0000-0000-0000-000000000003', 'baba@teste.dev');

-- O catálogo é semeado pela service role (conteudo:sync), não pela usuária.
insert into public.sintomas_catalogo (slug, nome, grupo) values ('azia', 'Azia', 'digestivo') on conflict do nothing;

-- Helena registra um sintoma e um bebê.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.sintomas (id, data, slug, intensidade) values ('10000000-0000-0000-0000-000000000001', current_date, 'azia', 2);
insert into public.bebes (id, nome, nascido_em) values ('20000000-0000-0000-0000-000000000001', 'Theo', now());
select is((select count(*) from public.sintomas), 1::bigint, 'Helena lê o próprio sintoma');

-- A babá entra por convite como cuidadora.
-- O token passa por variável de sessão: quem é convidado não lê a tabela de convites.
select lives_ok($$ select set_config('teste.token', public.criar_convite('cuidador'), true) $$, 'a dona gera convite');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok($$ select public.aceitar_convite(current_setting('teste.token'), 'Babá') $$, 'a cuidadora aceita');
select is((select count(*) from public.bebes), 1::bigint, 'a cuidadora vê o bebê');
select is((select count(*) from public.sintomas), 0::bigint, 'a cuidadora NÃO vê os sintomas da mãe (CUI-05)');

-- Outra família não enxerga nada.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from public.bebes), 0::bigint, 'outra família não lê os bebês (RLS)');

select * from finish();
rollback;
