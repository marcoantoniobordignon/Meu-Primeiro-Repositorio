-- Funcionalidade 07 · Retrospectiva: só a gestante vê e edita (critério do parceiro), obrigatórios nunca ocultos
-- (RN-05), uma por tipo, e o nascimento com peso e comprimento opcionais nas faixas da RN-02.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a1', 'gestante@teste.dev'),
  ('00000000-0000-0000-0000-0000000007c1', 'parceiro@teste.dev');
delete from public.membros_familia where profile_id = '00000000-0000-0000-0000-0000000007c1';
insert into public.membros_familia (familia_id, profile_id, papel)
  select familia_id, '00000000-0000-0000-0000-0000000007c1', 'parceiro' from public.membros_familia where profile_id = '00000000-0000-0000-0000-0000000007a1';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}';
select lives_ok($$ insert into public.retrospectives (id, kind, hidden_slides, chosen_entries) values ('e0700000-0000-0000-0000-000000000001', 'preview', '{belly}', '{"quote": {"texto": "Você já era amado."}}') $$, 'a gestante cria a prévia');
select is((select (familia_id is not null, criado_por)::text from public.retrospectives), '(t,00000000-0000-0000-0000-0000000007a1)', 'família e autora preenchidas');
select throws_ok($$ insert into public.retrospectives (id, kind) values (gen_random_uuid(), 'preview') $$, '23505', null, 'uma retrospectiva por tipo');
select throws_ok($$ update public.retrospectives set hidden_slides = '{closing}', atualizado_em = now() + interval '1 second' $$, '23514', null, 'RN-05: obrigatório não se oculta');
select throws_ok($$ insert into public.retrospectives (id, kind) values (gen_random_uuid(), 'resumo') $$, '23514', null, 'tipo da lista');
select throws_ok($$ insert into public.retrospectives (id, kind, chosen_entries) values (gen_random_uuid(), 'final', '[]') $$, '23514', null, 'chosen_entries é objeto');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007c1","role":"authenticated"}';
select is((select count(*) from public.retrospectives), 0::bigint, 'critério: o parceiro não vê a retrospectiva');
select throws_ok($$ insert into public.retrospectives (id, kind) values (gen_random_uuid(), 'final') $$, '42501', null, 'nem cria');

-- RN-02/10: peso e comprimento opcionais, nas faixas.
reset role;
select lives_ok($$ insert into public.bebes (id, familia_id, nome, nascido_em) select 'b0700000-0000-0000-0000-000000000001', familia_id, 'Theo', now() from public.membros_familia where profile_id = '00000000-0000-0000-0000-0000000007a1' $$, 'nascimento só com a data');
select throws_ok($$ update public.bebes set peso_g = 450 where id = 'b0700000-0000-0000-0000-000000000001' $$, '23514', null, 'peso de 500 a 7000 g');
select throws_ok($$ update public.bebes set comprimento_cm = 70 where id = 'b0700000-0000-0000-0000-000000000001' $$, '23514', null, 'comprimento de 20 a 65 cm');

select * from finish();
rollback;
