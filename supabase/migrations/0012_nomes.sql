-- Funcionalidade 15 · Lista de nomes com votação do casal.
--
-- Decisões (também no CHANGELOG):
--   * "pregnancy" é a família (uma gestação por família, como no resto do app): `name_votes.familia_id` e
--     `familias.baby_name`.
--   * O match é uma tabela (`name_matches`) gravada por trigger com security definer, no lugar da view
--     `name_matches_v`: com a RLS dos votos (cada um vê só os seus, RN-06), uma view com os votos dos dois não
--     enxergaria o do outro. Os dois leem só os matches (nunca os votos).
--   * `chave` normaliza o voto (id do catálogo, ou o nome próprio sem acento e sem maiúscula): é ela que faz o match
--     e o unique por pessoa.
--   * Ranking único por pessoa sem constraint (a fila envia uma linha por vez): o trigger tira a posição de quem
--     a tinha. O app sempre manda a lista inteira.
--   * O match desfeito (um dos dois mudou o voto) fica marcado e volta sem aviso novo: o push sai uma vez só.

create table public.names_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 40),
  sex_hint text not null check (sex_hint in ('f', 'm', 'u')),
  origin text,
  meaning text check (char_length(meaning) <= 160),
  ibge_rank_f int check (ibge_rank_f > 0),
  ibge_rank_m int check (ibge_rank_m > 0),
  syllables smallint not null check (syllables between 1 and 8),
  saint_name text,
  saint_day text check (saint_day ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  reviewed boolean not null default false,
  atualizado_em timestamptz not null default now()
);
create unique index names_catalog_nome_normalizado on public.names_catalog (public.normalizar_busca(name));
create trigger names_catalog_carimbo before insert or update on public.names_catalog for each row execute function public.faith_prayers_carimbar();

create table public.name_votes (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name_id uuid references public.names_catalog (id) on delete cascade,
  custom_name text check (char_length(custom_name) between 1 and 40 and custom_name ~ '^[[:alpha:]]+([ -][[:alpha:]]+)*$'),
  vote text not null check (vote in ('like', 'dislike')),
  rank smallint check (rank between 1 and 10),
  chave text generated always as (coalesce(name_id::text, 'c:' || public.normalizar_busca(custom_name))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  -- Exatamente um entre o catálogo e o nome próprio; só curtido entra no ranking.
  check ((name_id is null) <> (custom_name is null)),
  check (rank is null or vote = 'like'),
  unique (familia_id, user_id, chave)
);
create trigger name_votes_familia before insert on public.name_votes for each row execute function public.preencher_familia();
create trigger name_votes_conflito before update on public.name_votes for each row execute function public.manter_mais_recente();

create table public.name_matches (
  familia_id uuid not null references public.familias (id) on delete cascade,
  chave text not null,
  name_id uuid references public.names_catalog (id) on delete cascade,
  custom_name text,
  primeiro uuid references public.profiles (id) on delete set null,
  segundo uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  desfeito_em timestamptz,
  atualizado_em timestamptz not null default now(),
  primary key (familia_id, chave)
);

alter table public.familias add column baby_name text check (char_length(baby_name) <= 40), add column baby_name_chosen_at timestamptz;

-- Nome próprio: espaços simples, sem pontas e com inicial maiúscula.
create or replace function public.name_votes_normalizar()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.custom_name is not null then
    new.custom_name := regexp_replace(trim(new.custom_name), '\s+', ' ', 'g');
    -- Digitado todo em minúsculas ("joaquim") vira "Joaquim"; quem escreveu com maiúsculas fica como escreveu.
    if new.custom_name = lower(new.custom_name) then new.custom_name := initcap(new.custom_name); end if;
  end if;
  new.updated_at := now();
  if new.vote = 'dislike' or new.apagado_em is not null then new.rank := null; end if;
  return new;
end $$;
create trigger name_votes_normalizar before insert or update on public.name_votes for each row execute function public.name_votes_normalizar();

-- RN-04: uma posição por pessoa; quem tinha a posição perde (o app manda a lista inteira na ordem nova).
create or replace function public.name_votes_ranking()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rank is not null then
    -- `atualizado_em` nunca anda para trás (senão o manter_mais_recente devolve a linha antiga).
    update public.name_votes set rank = null, atualizado_em = greatest(atualizado_em, new.atualizado_em, now())
      where familia_id = new.familia_id and user_id = new.user_id and rank = new.rank and id <> new.id;
  end if;
  return new;
end $$;
create trigger name_votes_ranking_insert after insert on public.name_votes for each row when (new.rank is not null) execute function public.name_votes_ranking();
create trigger name_votes_ranking_update after update of rank on public.name_votes for each row when (new.rank is not null and new.rank is distinct from old.rank) execute function public.name_votes_ranking();

-- RN-05: match quando a gestante e o parceiro ativos curtem a mesma chave; o primeiro recebe o push `name_match`.
create or replace function public.name_votes_match()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_outro uuid;
  v_existia boolean;
begin
  if new.vote = 'like' and new.apagado_em is null then
    select v.user_id into v_outro from public.name_votes v
      join public.membros_familia m on m.familia_id = v.familia_id and m.profile_id = v.user_id
      where v.familia_id = new.familia_id and v.chave = new.chave and v.user_id <> new.user_id
        and v.vote = 'like' and v.apagado_em is null and m.papel in ('mae', 'parceiro') and m.removido_em is null
      limit 1;
    if v_outro is null then return new; end if;
    if not exists (select 1 from public.membros_familia where familia_id = new.familia_id and profile_id = new.user_id and papel in ('mae', 'parceiro') and removido_em is null) then
      return new;
    end if;
    select exists (select 1 from public.name_matches where familia_id = new.familia_id and chave = new.chave) into v_existia;
    insert into public.name_matches (familia_id, chave, name_id, custom_name, primeiro, segundo)
      values (new.familia_id, new.chave, new.name_id, new.custom_name, v_outro, new.user_id)
      on conflict (familia_id, chave) do update set desfeito_em = null, atualizado_em = now();
    if not v_existia then
      insert into public.avisos (familia_id, para, tipo, titulo, corpo, url, push_pendente)
        values (new.familia_id, v_outro, 'name_match', 'Deu match!', 'Vocês dois curtiram o mesmo nome. Veja qual.', '/nomes/meus?aba=match', true);
    end if;
  else
    update public.name_matches set desfeito_em = now(), atualizado_em = now()
      where familia_id = new.familia_id and chave = new.chave and desfeito_em is null;
  end if;
  return new;
end $$;
create trigger name_votes_match after insert or update on public.name_votes for each row execute function public.name_votes_match();

alter table public.names_catalog enable row level security;
alter table public.name_votes enable row level security;
alter table public.name_matches enable row level security;
create policy "nomes: catálogo para todos" on public.names_catalog for select using (true);
create policy "nomes: revisor escreve" on public.names_catalog for all using (public.eh_revisor()) with check (public.eh_revisor());
-- RN-06: cada um vê e escreve só os próprios votos.
create policy "votos de nome: os meus" on public.name_votes for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.eh_membro(familia_id));
-- RN-06: os matches, os dois veem (gestante e parceiro ativos da família).
create policy "matches: o casal" on public.name_matches for select using (
  exists (select 1 from public.membros_familia m where m.familia_id = name_matches.familia_id and m.profile_id = auth.uid() and m.papel in ('mae', 'parceiro') and m.removido_em is null)
);

-- RN-07: "Este é o nome!". Com parceiro ativo, só um nome que deu match; sem parceiro, um nome que ela curtiu.
create or replace function public.escolher_nome(p_chave text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_familia uuid;
  v_nome text;
  v_tem_parceiro boolean;
begin
  select familia_id into v_familia from public.membros_familia where profile_id = auth.uid() and papel in ('mae', 'parceiro') and removido_em is null;
  if v_familia is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select exists (select 1 from public.membros_familia where familia_id = v_familia and papel = 'parceiro' and removido_em is null) into v_tem_parceiro;
  if v_tem_parceiro then
    select coalesce(c.name, m.custom_name) into v_nome from public.name_matches m left join public.names_catalog c on c.id = m.name_id
      where m.familia_id = v_familia and m.chave = p_chave and m.desfeito_em is null;
  else
    select coalesce(c.name, v.custom_name) into v_nome from public.name_votes v left join public.names_catalog c on c.id = v.name_id
      where v.familia_id = v_familia and v.user_id = auth.uid() and v.chave = p_chave and v.vote = 'like' and v.apagado_em is null;
  end if;
  if v_nome is null then raise exception 'nome_sem_match'; end if;
  update public.familias set baby_name = v_nome, baby_name_chosen_at = now(), atualizado_em = now() where id = v_familia;
  return v_nome;
end $$;

create or replace function public.desfazer_nome()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_familia uuid;
begin
  select familia_id into v_familia from public.membros_familia where profile_id = auth.uid() and papel in ('mae', 'parceiro') and removido_em is null;
  if v_familia is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  update public.familias set baby_name = null, baby_name_chosen_at = null, atualizado_em = now() where id = v_familia;
end $$;
revoke all on function public.escolher_nome(text), public.desfazer_nome() from public;
grant execute on function public.escolher_nome(text), public.desfazer_nome() to authenticated;

-- O nome escolhido chega aos dois pela `minha_familia`.
drop function public.minha_familia();
create function public.minha_familia()
returns table (familia_id uuid, papel text, plano text, trial_fim timestamptz, cortesia_fim timestamptz, modo text, dpp date, baby_name text)
language sql stable security definer set search_path = public as $$
  select f.id, m.papel, f.plano, f.trial_fim, f.cortesia_fim, v.modo,
         (select g.dpp from public.membros_familia mg join public.profiles g on g.id = mg.profile_id
           where mg.familia_id = f.id and mg.papel = 'mae' and mg.removido_em is null limit 1),
         f.baby_name
  from public.membros_familia m join public.familias f on f.id = m.familia_id join public.v_modo v on v.familia_id = f.id
  where m.profile_id = auth.uid() and m.removido_em is null
$$;
grant execute on function public.minha_familia() to authenticated;
