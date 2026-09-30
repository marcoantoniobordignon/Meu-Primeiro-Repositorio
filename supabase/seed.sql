-- Seed local. O catálogo de sintomas e o banco de conteúdo entram por `pnpm conteudo:sync`
-- (lê supabase/seed/*.json e src/conteudo/banco.json e faz upsert com a service role).
-- Aqui só o que é fixo: admins do painel de conteúdo (spec 07).
insert into public.admins (email) values ('pietroanez.work@gmail.com') on conflict do nothing;
