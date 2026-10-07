-- Ninho · funcionalidade 09 (specs/funcionalidades/09-faq-comidas.md): FAQ de comidas na gravidez.
-- Desvios do modelo da spec:
--   * `reviewed_by`/`reviewed_on` aceitam nulo em rascunho: o conteúdo inicial é rascunho escrito com IA
--     e só um revisor humano publica (RN-01/09). Publicado sem revisor é barrado no banco;
--   * `faq_favorites` ganha `id`/`atualizado_em`/`apagado_em` para a fila offline (favorito vale sem rede);
--   * `views_count` conta aberturas do verbete (sem quem abriu) para "Mais buscados" (RN-10);
--   * revisor = `profiles.is_reviewer` (ou admin); o painel `/admin/faq` usa as RPCs `faq_*`;
--   * avisos de resposta saem pela central (`avisos`) e o job manda o push `faq_answer` (RN-07).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
-- O índice e a busca rodam com o papel de quem chama (no Supabase isso já vem concedido).
grant usage on schema extensions to anon, authenticated, service_role;

-- RN-02: `lower(unaccent(texto))`, imutável para poder virar índice.
create or replace function public.normalizar_busca(t text)
returns text language sql immutable parallel safe set search_path = public, extensions as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')))
$$;

-- Os apelidos juntos, imutável para o índice (array_to_string é só "stable").
create or replace function public.faq_texto_aliases(a text[])
returns text language plpgsql immutable parallel safe set search_path = public as $$
begin
  return public.normalizar_busca(array_to_string(a, ' '));
end $$;

-- RN-02: a melhor similaridade trigram entre a busca e o texto inteiro ou qualquer trecho de palavras
-- seguidas dele ("peixe" acha "Peixe cru (sushi, ceviche)"). O app faz a mesma conta (`@dominio/faq.ts`).
create or replace function public.faq_pontuacao(q text, texto text)
returns real language plpgsql immutable set search_path = public, extensions as $$
declare
  nq text := public.normalizar_busca(q);
  palavras text[] := regexp_split_to_array(trim(regexp_replace(public.normalizar_busca(texto), '[^a-z0-9]+', ' ', 'g')), ' ');
  melhor real := extensions.similarity(nq, public.normalizar_busca(texto));
  n int := coalesce(array_length(palavras, 1), 0);
  i int;
  j int;
begin
  if nq = '' or n = 0 then return 0; end if;
  for i in 1..n loop
    for j in i..n loop
      melhor := greatest(melhor, extensions.similarity(nq, array_to_string(palavras[i:j], ' ')));
    end loop;
  end loop;
  return melhor;
end $$;

alter table public.profiles add column is_reviewer boolean not null default false;

create or replace function public.eh_revisor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_admin() or coalesce((select is_reviewer from public.profiles where id = auth.uid()), false)
$$;

-- O painel sabe se a pessoa é admin ou revisora (o revisor só vê o FAQ).
create or replace function public.admin_eu()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('email', auth.jwt() ->> 'email', 'admin', public.eh_admin(), 'revisor', public.eh_revisor())
$$;

create table public.faq_foods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  aliases text[] not null default '{}',
  category text not null check (category in ('meat', 'fish', 'dairy', 'fruit_veg', 'drink', 'sweet', 'herb_tea', 'other')),
  verdict text not null check (verdict in ('safe', 'caution', 'avoid')),
  short_answer text not null check (char_length(short_answer) <= 200),
  details text check (char_length(details) <= 800),
  condition_note text check (char_length(condition_note) <= 200),
  source_label text not null check (char_length(source_label) between 1 and 200),
  source_url text check (source_url ~ '^https?://'),
  reviewed_by text check (char_length(reviewed_by) <= 120),
  reviewed_on date,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  views_count int not null default 0,
  asked_count int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- RN-01/09: publicar exige fonte e revisão humana.
  check (status <> 'published' or (reviewed_by is not null and trim(reviewed_by) <> '' and reviewed_on is not null))
);
create index faq_foods_nome_trgm on public.faq_foods using gin (public.normalizar_busca(name) extensions.gin_trgm_ops);
create index faq_foods_aliases_trgm on public.faq_foods using gin (public.faq_texto_aliases(aliases) extensions.gin_trgm_ops);
create index faq_foods_atualizados on public.faq_foods (atualizado_em) where status = 'published';

create table public.faq_questions (
  id uuid primary key default gen_random_uuid(),
  asked_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  text text not null check (char_length(trim(text)) between 3 and 140),
  normalized text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'rejected', 'duplicate')),
  duplicate_of uuid references public.faq_questions (id) on delete set null,
  answered_food_id uuid references public.faq_foods (id) on delete set null,
  reject_reason text check (reject_reason in ('fora_do_escopo', 'pergunta_medica', 'repetida')),
  votes_count int not null default 1,
  created_at timestamptz not null default now(),
  check (status <> 'rejected' or reject_reason is not null)
);
create index faq_questions_abertas on public.faq_questions using gin (normalized extensions.gin_trgm_ops) where status = 'open';
create index faq_questions_por_dia on public.faq_questions (asked_by, created_at desc);

create table public.faq_question_votes (
  question_id uuid not null references public.faq_questions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (question_id, user_id)
);

create table public.faq_favorites (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  food_id uuid not null references public.faq_foods (id) on delete cascade,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  unique (user_id, food_id)
);
create trigger faq_favorites_conflito before update on public.faq_favorites for each row execute function public.manter_mais_recente();

-- RN-05: bloqueio de ofensas por lista simples (a mesma lista do app, `@dominio/faq.ts`).
create table public.faq_bloqueio (palavra text primary key);
insert into public.faq_bloqueio (palavra) values
  ('porra'), ('caralho'), ('merda'), ('buceta'), ('puta'), ('puto'), ('foder'), ('fodase'), ('foda'), ('cacete'),
  ('arrombado'), ('arrombada'), ('viado'), ('desgracado'), ('desgracada'), ('vagabunda'), ('vagabundo'), ('piranha'),
  ('otario'), ('otaria'), ('imbecil'), ('idiota'), ('babaca'), ('cuzao'), ('fdp'), ('vsf'), ('pqp'), ('krl'), ('bosta'), ('retardado');

alter table public.faq_foods enable row level security;
alter table public.faq_questions enable row level security;
alter table public.faq_question_votes enable row level security;
alter table public.faq_favorites enable row level security;
alter table public.faq_bloqueio enable row level security;

-- RN-01: só o publicado aparece; o revisor vê e edita tudo.
create policy "faq: publicado para todos" on public.faq_foods for select using (status = 'published' or public.eh_revisor());
create policy "faq: revisor escreve" on public.faq_foods for all using (public.eh_revisor()) with check (public.eh_revisor());
-- Funcionalidade 12: perguntas do FAQ nunca são vistas pelo parceiro; cada um vê só as suas (o revisor, todas).
create policy "perguntas: as minhas" on public.faq_questions for select using (asked_by = auth.uid() or public.eh_revisor());
create policy "votos: os meus" on public.faq_question_votes for select using (user_id = auth.uid());
create policy "favoritos: os meus" on public.faq_favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- RN-02: até 20 publicados, similaridade ≥ 0,3, por similaridade.
create or replace function public.buscar_faq(q text)
returns table (slug text, name text, verdict text, category text, pontuacao real)
language sql stable security definer set search_path = public, extensions as $$
  select f.slug, f.name, f.verdict, f.category, s.p
    from public.faq_foods f
    cross join lateral (
      select greatest(public.faq_pontuacao(q, f.name), coalesce((select max(public.faq_pontuacao(q, a)) from unnest(f.aliases) a), 0)) as p
    ) s
   where f.status = 'published' and s.p >= 0.3
   order by s.p desc, public.faq_pontuacao(q, f.name) desc, char_length(f.name), f.name
   limit 20
$$;

-- RN-10: "Mais buscados" (conta a abertura, sem quem abriu).
create or replace function public.faq_contar_visualizacao(p_slug text)
returns void language sql security definer set search_path = public as $$
  update public.faq_foods set views_count = views_count + 1 where slug = p_slug and status = 'published'
$$;

-- RN-06: perguntas abertas parecidas (≥ 0,6), para votar em vez de duplicar.
create or replace function public.faq_perguntas_parecidas(p_texto text)
returns table (id uuid, text text, votes_count int, ja_votei boolean)
language sql stable security definer set search_path = public, extensions as $$
  select q.id, q.text, q.votes_count, exists (select 1 from public.faq_question_votes v where v.question_id = q.id and v.user_id = auth.uid())
    from public.faq_questions q
   where q.status = 'open' and extensions.similarity(q.normalized, public.normalizar_busca(p_texto)) >= 0.6
   order by extensions.similarity(q.normalized, public.normalizar_busca(p_texto)) desc, q.votes_count desc
   limit 3
$$;

create or replace function public.faq_tem_ofensa(p_texto text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.faq_bloqueio b
     where b.palavra = any (regexp_split_to_array(public.normalizar_busca(p_texto), '[^a-z0-9]+'))
  )
$$;

-- RN-05/06: 3 a 140 caracteres, sem ofensa, até 5 por dia; parecida com uma aberta → não cria (vota).
create or replace function public.faq_perguntar(p_texto text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  t text := trim(coalesce(p_texto, ''));
  nova uuid;
begin
  if auth.uid() is null then raise exception 'sem_sessao'; end if;
  if char_length(t) < 3 or char_length(t) > 140 then raise exception 'tamanho'; end if;
  if public.faq_tem_ofensa(t) then raise exception 'ofensa'; end if;
  if (select count(*) from public.faq_questions where asked_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'limite_diario';
  end if;
  if exists (select 1 from public.faq_perguntas_parecidas(t)) then raise exception 'parecida'; end if;
  insert into public.faq_questions (asked_by, text, normalized) values (auth.uid(), t, public.normalizar_busca(t)) returning id into nova;
  insert into public.faq_question_votes (question_id, user_id) values (nova, auth.uid());
  return nova;
end $$;

-- RN-06: "Eu também quero saber": um voto por pessoa.
create or replace function public.faq_votar(p_pergunta uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'sem_sessao'; end if;
  if not exists (select 1 from public.faq_questions where id = p_pergunta and status = 'open') then raise exception 'fechada'; end if;
  insert into public.faq_question_votes (question_id, user_id) values (p_pergunta, auth.uid()) on conflict do nothing;
  update public.faq_questions set votes_count = (select count(*) from public.faq_question_votes where question_id = p_pergunta) where id = p_pergunta returning votes_count into n;
  return n;
end $$;

-- Painel: abertas por votos.
create or replace function public.faq_perguntas_abertas()
returns table (id uuid, text text, votes_count int, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_revisor() then raise exception 'só revisor' using errcode = '42501'; end if;
  return query select q.id, q.text, q.votes_count, q.created_at from public.faq_questions q where q.status = 'open' order by q.votes_count desc, q.created_at;
end $$;

-- RN-01/07: publicar (com revisão) e responder perguntas; cada votante recebe aviso + push `faq_answer`, um por pergunta.
alter table public.avisos add column push_pendente boolean not null default false;
create index avisos_push_pendente on public.avisos (criado_em) where push_pendente;

create or replace function public.faq_publicar(p_food uuid, p_perguntas uuid[] default '{}', p_revisor text default null, p_revisado_em date default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  f public.faq_foods;
  respondidas int := 0;
begin
  if not public.eh_revisor() then raise exception 'só revisor' using errcode = '42501'; end if;
  update public.faq_foods
     set status = 'published',
         reviewed_by = coalesce(nullif(trim(p_revisor), ''), reviewed_by),
         reviewed_on = coalesce(p_revisado_em, reviewed_on, current_date),
         atualizado_em = now()
   where id = p_food
  returning * into f;
  if f.id is null then raise exception 'verbete inexistente'; end if;

  with resp as (
    update public.faq_questions set status = 'answered', answered_food_id = p_food
     where id = any (p_perguntas) and status = 'open'
    returning id
  )
  select count(*) into respondidas from resp;

  insert into public.avisos (para, tipo, titulo, corpo, url, push_pendente)
  select distinct v.user_id, 'faq_answer', 'Sua pergunta foi respondida: ' || f.name, null, '/faq/verbete?slug=' || f.slug || '&origem=lembrete&categoria=faq', true
    from public.faq_question_votes v
   where v.question_id = any (p_perguntas)
     and exists (select 1 from public.faq_questions q where q.id = v.question_id and q.answered_food_id = p_food);

  update public.faq_foods set asked_count = coalesce((select sum(votes_count) from public.faq_questions where answered_food_id = p_food), 0), atualizado_em = now() where id = p_food;
  return respondidas;
end $$;

-- RN-08: rejeitar com motivo padronizado; aviso só na central, sem push.
create or replace function public.faq_rejeitar(p_pergunta uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare q public.faq_questions;
begin
  if not public.eh_revisor() then raise exception 'só revisor' using errcode = '42501'; end if;
  update public.faq_questions set status = 'rejected', reject_reason = p_motivo where id = p_pergunta and status = 'open' returning * into q;
  if q.id is null then raise exception 'pergunta inexistente'; end if;
  insert into public.avisos (para, tipo, titulo, corpo, push_pendente)
  select v.user_id, 'faq_rejected', 'Sobre a sua pergunta: "' || left(q.text, 60) || '"',
         case p_motivo when 'fora_do_escopo' then 'Ela está fora do que o FAQ de comidas responde.'
                       when 'pergunta_medica' then 'Ela pede orientação médica: o melhor é perguntar ao seu médico ou nutricionista.'
                       else 'Ela já tem uma pergunta igual em andamento.' end,
         false
    from public.faq_question_votes v where v.question_id = q.id;
end $$;

revoke execute on function public.faq_perguntas_abertas(), public.faq_publicar(uuid, uuid[], text, date), public.faq_rejeitar(uuid, text) from public, anon;
grant execute on function public.buscar_faq(text), public.faq_contar_visualizacao(text) to anon, authenticated;
grant execute on function public.faq_perguntas_parecidas(text), public.faq_perguntar(text), public.faq_votar(uuid), public.faq_tem_ofensa(text),
  public.faq_perguntas_abertas(), public.faq_publicar(uuid, uuid[], text, date), public.faq_rejeitar(uuid, text), public.admin_eu() to authenticated;

-- RN-07: o push de resposta entra no registro do que já saiu.
alter table public.reminders_sent drop constraint reminders_sent_categoria_check;
alter table public.reminders_sent add constraint reminders_sent_categoria_check check (categoria in ('med', 'exam', 'appt', 'belly', 'diary', 'partner', 'calendar', 'birth_plan', 'faq'));
