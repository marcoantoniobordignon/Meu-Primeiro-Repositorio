-- Funcionalidade 11 · Adaptação por trimestre: artigos por semana e trimestre, leituras e favoritos,
-- a tela de virada vista uma vez e o push `trimester_turn`.
--
-- Decisões (também no CHANGELOG):
--   * `reviewed_by`/`reviewed_on` podem ficar vazios no rascunho; publicar exige os dois (RN-09). Assim o
--     conteúdo inicial entra como rascunho e só um revisor humano publica (o mesmo do FAQ, funcionalidade 09).
--   * `trimester` é derivado de `week_from` (1: até 13, 2: 14 a 27, 3: 28 em diante), a mesma regra da virada.
--   * `article_reads` tem `id` (fila offline) e `unique (user_id, article_id)` no lugar da chave composta.
--   * `is_premium` existe e o app respeita (free vê o resumo e o paywall); na v1 tudo é gratuito (RN-11).

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 90),
  summary text not null check (char_length(summary) between 1 and 200),
  body_md text not null,
  hero_image_path text,
  week_from smallint not null check (week_from between 1 and 42),
  week_to smallint not null,
  trimester smallint generated always as (case when week_from < 14 then 1 when week_from < 28 then 2 else 3 end) stored,
  reading_minutes smallint not null default 3 check (reading_minutes between 1 and 60),
  featured boolean not null default false,
  position int not null default 0,
  is_premium boolean not null default false,
  reviewed_by text,
  reviewed_on date,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (week_to >= week_from and week_to <= 42),
  -- RN-09: publicado só com revisor e data.
  constraint articles_revisao check (status <> 'published' or (nullif(trim(reviewed_by), '') is not null and reviewed_on is not null))
);
create index articles_semana on public.articles (week_from, week_to) where status = 'published';

create or replace function public.articles_carimbar()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;
create trigger articles_carimbo before insert or update on public.articles for each row execute function public.articles_carimbar();

create table public.article_reads (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  first_opened_at timestamptz not null default now(),
  read_at timestamptz,
  is_favorite boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  unique (user_id, article_id)
);
create trigger article_reads_conflito before update on public.article_reads for each row execute function public.manter_mais_recente();

-- RN-04: "lido" não volta atrás (dois aparelhos: vale o primeiro que leu).
create or replace function public.article_reads_lido()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.read_at is not null then
    new.read_at := least(old.read_at, coalesce(new.read_at, old.read_at));
  end if;
  new.first_opened_at := least(old.first_opened_at, new.first_opened_at);
  return new;
end $$;
create trigger article_reads_lido before update on public.article_reads for each row execute function public.article_reads_lido();

alter table public.articles enable row level security;
alter table public.article_reads enable row level security;

-- RN-09: só o publicado aparece; o revisor vê e edita tudo.
create policy "artigos: publicado para todos" on public.articles for select using (status = 'published' or public.eh_revisor());
create policy "artigos: revisor escreve" on public.articles for all using (public.eh_revisor()) with check (public.eh_revisor());
-- Leituras e favoritos são de cada pessoa (nem o parceiro vê).
create policy "leituras: as minhas" on public.article_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RN-06: a tela de virada aparece uma vez por trimestre (em qualquer aparelho).
alter table public.profiles add column t2_seen_at timestamptz, add column t3_seen_at timestamptz;

-- RN-06: push `trimester_turn`, uma vez (a chave `trimester:<n>` fica em reminders_sent).
alter table public.reminders_sent drop constraint reminders_sent_categoria_check;
alter table public.reminders_sent add constraint reminders_sent_categoria_check check (categoria in ('med', 'exam', 'appt', 'belly', 'diary', 'partner', 'calendar', 'birth_plan', 'faq', 'trimester'));
