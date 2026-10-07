-- Funcionalidade 16 · Direitos da gestante: cartões revisados, favoritos, canais de ajuda e busca em português.
--
-- Decisões (também no CHANGELOG):
--   * `reviewed_by`/`reviewed_on` podem ficar vazios no rascunho; publicar exige base legal, revisor e data (RN-01).
--   * `content_updated_at` muda quando o texto do cartão muda (não quando só a revisão é renovada): é o que acende o
--     selo "Atualizado" para quem tinha favoritado (RN-09).
--   * `rights_favorites` tem `id` (fila offline) e `unique (user_id, card_id)` no lugar da chave composta.
--   * Cartões dispensados da home ficam em `profiles.prefs.rights_dismissed` (lista de slugs): não pedem tabela.
--   * Canais nascem inativos (`active = false`): os números são conferidos antes de ativar.
--   * RN-07: o parceiro vê só os cartões `partner` e `both` (na RLS); a gestante vê todos.

create table public.rights_cards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  topic text not null check (topic in ('work', 'health', 'birth', 'postpartum', 'benefits')),
  question text not null check (char_length(question) between 1 and 90),
  answer text not null check (char_length(answer) between 1 and 280),
  details_md text check (char_length(details_md) <= 1500),
  legal_basis text[] not null default '{}',
  legal_links text[] not null default '{}',
  what_to_do_md text not null default '' check (char_length(what_to_do_md) <= 600),
  week_from smallint check (week_from between 1 and 42),
  week_to smallint check (week_to between 1 and 42),
  applies_to text not null default 'mother' check (applies_to in ('mother', 'partner', 'both')),
  position int not null default 0,
  reviewed_by text,
  reviewed_on date,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  content_updated_at timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((week_from is null) = (week_to is null) and (week_to is null or week_to >= week_from)),
  -- RN-01: publicado só com base legal, revisor e data.
  constraint rights_cards_revisao check (
    status <> 'published' or (cardinality(legal_basis) > 0 and nullif(trim(reviewed_by), '') is not null and reviewed_on is not null)
  )
);

create or replace function public.rights_cards_carimbar()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  if tg_op = 'UPDATE' and (new.question, new.answer, new.details_md, new.legal_basis, new.legal_links, new.what_to_do_md)
      is distinct from (old.question, old.answer, old.details_md, old.legal_basis, old.legal_links, old.what_to_do_md) then
    new.content_updated_at := now();
  end if;
  return new;
end $$;
create trigger rights_cards_carimbo before insert or update on public.rights_cards for each row execute function public.rights_cards_carimbar();

create table public.rights_favorites (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  card_id uuid not null references public.rights_cards (id) on delete cascade,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  unique (user_id, card_id)
);
create trigger rights_favorites_conflito before update on public.rights_favorites for each row execute function public.manter_mais_recente();

create table public.help_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  phone text check (phone ~ '^[0-9]{3,13}$'),
  url text check (url ~ '^https://'),
  description text not null default '',
  position int not null default 0,
  active boolean not null default false,
  atualizado_em timestamptz not null default now(),
  check (phone is not null or url is not null)
);
create trigger help_channels_carimbo before insert or update on public.help_channels for each row execute function public.faith_prayers_carimbar();

-- Parceiro ativo em alguma gestação (RN-07).
create or replace function public.sou_parceiro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros_familia where profile_id = auth.uid() and papel = 'parceiro' and removido_em is null)
$$;

alter table public.rights_cards enable row level security;
alter table public.rights_favorites enable row level security;
alter table public.help_channels enable row level security;
create policy "direitos: publicado (o parceiro, só os dele)" on public.rights_cards for select
  using ((status = 'published' and (applies_to <> 'mother' or not public.sou_parceiro())) or public.eh_revisor());
create policy "direitos: revisor escreve" on public.rights_cards for all using (public.eh_revisor()) with check (public.eh_revisor());
create policy "favoritos de direitos: os meus" on public.rights_favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "canais: ativos para todos" on public.help_channels for select using (active or public.eh_revisor());
create policy "canais: revisor escreve" on public.help_channels for all using (public.eh_revisor()) with check (public.eh_revisor());

-- RN-04: busca em português (com radical) na pergunta e na resposta, mais filtro por tema. Respeita a RLS.
create or replace function public.buscar_direitos(p_q text, p_topic text default null)
returns setof public.rights_cards language sql stable set search_path = public, extensions as $$
  select c.* from public.rights_cards c
  where (p_topic is null or c.topic = p_topic)
    and to_tsvector('portuguese', public.normalizar_busca(c.question || ' ' || c.answer)) @@ plainto_tsquery('portuguese', public.normalizar_busca(p_q))
  order by ts_rank(to_tsvector('portuguese', public.normalizar_busca(c.question || ' ' || c.answer)), plainto_tsquery('portuguese', public.normalizar_busca(p_q))) desc, c.topic, c.position
  limit 30
$$;

-- RN-02: cartões publicados com revisão de mais de 12 meses (o alerta do revisor).
create or replace function public.direitos_para_revisar()
returns table (slug text, question text, reviewed_on date) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_revisor() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  return query select c.slug, c.question, c.reviewed_on from public.rights_cards c
    where c.status = 'published' and c.reviewed_on < current_date - interval '12 months' order by c.reviewed_on;
end $$;
