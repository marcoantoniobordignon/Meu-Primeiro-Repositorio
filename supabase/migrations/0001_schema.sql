-- Ninho · schema consolidado (spec 01, com as tabelas das specs 05–12).
-- Convenções: id gerado no cliente (uuid), familia_id preenchido por trigger,
-- atualizado_em resolve conflito (ARQ-02), apagado_em é soft delete.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Perfis e famílias
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  modo text not null default 'gestacao' check (modo in ('gestacao', 'bebe')),
  dpp date,
  tema text not null default 'auto' check (tema in ('auto', 'claro', 'escuro')),
  bebe_ativo_id uuid,
  telefone_equipe text,
  push_preferencias jsonb not null default '{}'::jsonb,
  onboarding_concluido_em timestamptz,
  ultimo_acesso_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.familias (
  id uuid primary key default gen_random_uuid(),
  dona_id uuid not null references public.profiles (id) on delete cascade,
  plano text not null default 'free' check (plano in ('free', 'trial', 'ativo', 'expirado')),
  trial_fim timestamptz,
  cortesia_fim timestamptz,
  stripe_customer_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.membros_familia (
  familia_id uuid not null references public.familias (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  papel text not null check (papel in ('mae', 'parceiro', 'avo', 'cuidador')),
  convidado_por uuid references public.profiles (id) on delete set null,
  ultimo_acesso_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  primary key (familia_id, profile_id)
);
-- CUI-03: uma família por pessoa nesta versão.
create unique index membros_familia_um_por_pessoa on public.membros_familia (profile_id);

-- ---------------------------------------------------------------------------
-- Helpers de segurança
-- ---------------------------------------------------------------------------
create or replace function public.familia_do_usuario()
returns uuid language sql stable security definer set search_path = public as $$
  select familia_id from public.membros_familia where profile_id = auth.uid() limit 1
$$;

create or replace function public.papel_do_usuario()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.membros_familia where profile_id = auth.uid() limit 1
$$;

create or replace function public.eh_membro(f uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros_familia where familia_id = f and profile_id = auth.uid())
$$;

-- CUI-04/05: mãe e parceiro veem tudo; avó e cuidador não veem dados da mãe.
create or replace function public.ve_dados_da_mae()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.papel_do_usuario() in ('mae', 'parceiro'), false)
$$;

create table public.admins (email text primary key);
create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = auth.jwt() ->> 'email')
$$;

-- ---------------------------------------------------------------------------
-- Triggers genéricos
-- ---------------------------------------------------------------------------
-- ARQ-02: conflito no mesmo id, vence o maior atualizado_em; nunca duplica.
create or replace function public.manter_mais_recente()
returns trigger language plpgsql as $$
begin
  if new.atualizado_em < old.atualizado_em then
    return old;
  end if;
  return new;
end $$;

-- familia_id e criado_por vêm da sessão quando o cliente não manda.
create or replace function public.preencher_familia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.familia_id is null then
    new.familia_id := public.familia_do_usuario();
  end if;
  if new.familia_id is null then
    raise exception 'usuário sem família';
  end if;
  return new;
end $$;

create or replace function public.preencher_autor()
returns trigger language plpgsql as $$
begin
  if new.criado_por is null then
    new.criado_por := auth.uid();
  end if;
  return new;
end $$;

-- Primeiro login (anônimo ou não): perfil + família + membro 'mae' (ARQ-03).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f uuid;
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.familias (dona_id) values (new.id) returning id into f;
  insert into public.membros_familia (familia_id, profile_id, papel) values (f, new.id, 'mae');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_conflito before update on public.profiles for each row execute function public.manter_mais_recente();
create trigger familias_conflito before update on public.familias for each row execute function public.manter_mais_recente();

-- ---------------------------------------------------------------------------
-- Tabelas de família (mesma régua: id do cliente, familia_id, autor, datas)
-- ---------------------------------------------------------------------------
create table public.bebes (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  nome text not null,
  nascido_em timestamptz not null,
  prematuro_semanas int check (prematuro_semanas between 20 and 41),
  ordem smallint not null default 0,
  aviso_soneca boolean not null default false,
  registrado_em timestamptz not null default now(),
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);

create table public.registros (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  bebe_id uuid not null references public.bebes (id) on delete cascade,
  tipo text not null check (tipo in ('sono', 'mamada', 'fralda', 'banho', 'outro')),
  inicio timestamptz not null,
  fim timestamptz,
  dados jsonb not null default '{}'::jsonb,
  origem text not null default 'manual' check (origem in ('voz', 'manual', 'timer')),
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create index registros_bebe_tipo_inicio on public.registros (bebe_id, tipo, inicio desc) where apagado_em is null;

create table public.sintomas_catalogo (
  slug text primary key,
  nome text not null,
  grupo text not null check (grupo in ('corpo', 'digestivo', 'humor', 'sono', 'bebe')),
  cor_token text,
  semanas_frequentes int[] not null default '{}',
  especial text
);

create table public.sintomas (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  data date not null,
  slug text not null references public.sintomas_catalogo (slug),
  intensidade smallint not null check (intensidade between 1 and 3),
  nota text,
  origem text not null default 'chip' check (origem in ('chip', 'sheet', 'onboarding', 'voz')),
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create unique index sintomas_um_por_dia on public.sintomas (familia_id, data, slug) where apagado_em is null;

create table public.consultas (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  data timestamptz not null,
  tipo text not null check (tipo in ('pre_natal', 'ultrassom', 'exame', 'outro')),
  profissional text,
  local text,
  realizada boolean not null default false,
  notas text,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);

create table public.sessoes_chutes (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz,
  total int not null default 0,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);

create table public.contracoes (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);

create table public.pos_parto_checkins (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  data date not null,
  dor smallint not null check (dor between 0 and 3),
  sangramento text check (sangramento in ('leve', 'moderado', 'intenso')),
  humor smallint not null check (humor between 1 and 5),
  nota text,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create unique index pos_parto_um_por_dia on public.pos_parto_checkins (familia_id, data) where apagado_em is null;

-- ---------------------------------------------------------------------------
-- Conteúdo (spec 07)
-- ---------------------------------------------------------------------------
create table public.conteudos (
  id text primary key,
  slug text not null unique,
  titulo text not null,
  corpo_md text not null,
  cards text[] not null default '{}',
  categoria text not null check (categoria in ('semana', 'corpo', 'bebe', 'parto', 'pos_parto', 'sono', 'amamentacao')),
  cor_token text not null,
  semana_min int,
  semana_max int,
  mes_bebe_min int,
  mes_bebe_max int,
  dia_da_semana smallint check (dia_da_semana between 0 and 6),
  minutos_leitura smallint not null,
  premium boolean not null default false,
  publicado boolean not null default false,
  atualizado_em timestamptz not null default now()
);

create table public.conteudos_lidos (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  conteudo_id text not null references public.conteudos (id) on delete cascade,
  lido_em timestamptz,
  guardado boolean not null default false,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create unique index conteudos_lidos_unico on public.conteudos_lidos (familia_id, conteudo_id) where apagado_em is null;

-- ---------------------------------------------------------------------------
-- Cuidadores (spec 12)
-- ---------------------------------------------------------------------------
create table public.convites (
  token text primary key,
  familia_id uuid not null references public.familias (id) on delete cascade,
  papel text not null check (papel in ('parceiro', 'avo', 'cuidador')),
  criado_por uuid not null references public.profiles (id) on delete cascade,
  expira_em timestamptz not null default now() + interval '72 hours',
  usado_por uuid references public.profiles (id),
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Voz (spec 08)
-- ---------------------------------------------------------------------------
create table public.voz_interpretacoes (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid references public.familias (id) on delete cascade,
  transcricao text,
  resposta jsonb,
  confianca numeric,
  aceita boolean,
  corrigida boolean not null default false,
  ms_total int,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers por tabela
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['bebes', 'registros', 'sintomas', 'consultas', 'sessoes_chutes', 'contracoes', 'pos_parto_checkins', 'conteudos_lidos', 'voz_interpretacoes']
  loop
    execute format('create trigger %I_familia before insert on public.%I for each row execute function public.preencher_familia()', t, t);
    execute format('create trigger %I_autor before insert on public.%I for each row execute function public.preencher_autor()', t, t);
  end loop;
  foreach t in array array['bebes', 'registros', 'sintomas', 'consultas', 'sessoes_chutes', 'contracoes', 'pos_parto_checkins', 'conteudos_lidos']
  loop
    execute format('create trigger %I_conflito before update on public.%I for each row execute function public.manter_mais_recente()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Views e RPCs
-- ---------------------------------------------------------------------------
-- NAV-01 / ARQ-07: modo derivado por família.
create view public.v_modo with (security_invoker = true) as
  select f.id as familia_id,
         case when exists (select 1 from public.bebes b where b.familia_id = f.id and b.apagado_em is null) then 'bebe' else 'gestacao' end as modo
  from public.familias f;

-- CUI-01: só a dona gera convites; parceiro pode gerar de cuidador.
create or replace function public.criar_convite(p_papel text)
returns text language plpgsql security definer set search_path = public as $$
declare
  f uuid := public.familia_do_usuario();
  p text := public.papel_do_usuario();
  t text;
begin
  if f is null then raise exception 'sem família'; end if;
  if not (p = 'mae' or (p = 'parceiro' and p_papel = 'cuidador')) then
    raise exception 'sem permissão para convidar';
  end if;
  if p_papel not in ('parceiro', 'avo', 'cuidador') then raise exception 'papel inválido'; end if;
  t := encode(gen_random_bytes(24), 'hex');
  t := substr(t, 1, 32);
  insert into public.convites (token, familia_id, papel, criado_por) values (t, f, p_papel, auth.uid());
  return t;
end $$;

-- Leitura pública mínima do convite (spec 12: só nome do bebê e de quem convidou).
create or replace function public.convite_publico(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.convites%rowtype;
  quem text;
  bebe text;
begin
  select * into c from public.convites where token = p_token;
  if not found then return jsonb_build_object('estado', 'inexistente'); end if;
  if c.usado_em is not null then return jsonb_build_object('estado', 'usado'); end if;
  if c.expira_em < now() then return jsonb_build_object('estado', 'expirado'); end if;
  select nome into quem from public.profiles where id = c.criado_por;
  select string_agg(nome, ' e ' order by ordem) into bebe from public.bebes where familia_id = c.familia_id and apagado_em is null;
  return jsonb_build_object('estado', 'valido', 'papel', c.papel, 'quem', coalesce(quem, 'Alguém'), 'bebe', coalesce(bebe, 'a gestação'));
end $$;

-- CUI-02/03/08/09: aceita uma vez, sai da família anterior, entra com o papel do convite.
create or replace function public.aceitar_convite(p_token text, p_nome text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c public.convites%rowtype;
  antiga uuid;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  select * into c from public.convites where token = p_token for update;
  if not found or c.usado_em is not null or c.expira_em < now() then
    raise exception 'convite inválido';
  end if;
  select familia_id into antiga from public.membros_familia where profile_id = auth.uid();
  delete from public.membros_familia where profile_id = auth.uid();
  -- A família antiga some se ficou vazia e era só desta pessoa (nada registrado ainda).
  if antiga is not null and not exists (select 1 from public.membros_familia where familia_id = antiga)
     and not exists (select 1 from public.bebes where familia_id = antiga)
     and not exists (select 1 from public.sintomas where familia_id = antiga) then
    delete from public.familias where id = antiga;
  end if;
  insert into public.membros_familia (familia_id, profile_id, papel, convidado_por) values (c.familia_id, auth.uid(), c.papel, c.criado_por);
  update public.convites set usado_por = auth.uid(), usado_em = now() where token = p_token;
  if p_nome is not null then update public.profiles set nome = p_nome, atualizado_em = now() where id = auth.uid(); end if;
  return c.familia_id;
end $$;

-- CUI-08: remover membro (só a dona). Os registros ficam.
create or replace function public.remover_membro(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare f uuid := public.familia_do_usuario();
begin
  if public.papel_do_usuario() <> 'mae' then raise exception 'só a dona remove'; end if;
  if p_profile_id = auth.uid() then raise exception 'não dá para se remover'; end if;
  delete from public.membros_familia where familia_id = f and profile_id = p_profile_id;
end $$;

-- VIR-02: cortesia de 7 dias a partir do nascimento, se a família não tem plano ativo.
create or replace function public.iniciar_cortesia(p_nascido_em timestamptz)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare f uuid := public.familia_do_usuario(); fim timestamptz;
begin
  update public.familias set cortesia_fim = p_nascido_em + interval '7 days', atualizado_em = now()
    where id = f and plano <> 'ativo' returning cortesia_fim into fim;
  return fim;
end $$;

-- Membros da minha família, com nome (para tiles e linha do tempo).
create or replace function public.meus_membros()
returns table (profile_id uuid, nome text, papel text, convidado_por uuid, ultimo_acesso_em timestamptz)
language sql stable security definer set search_path = public as $$
  select m.profile_id, p.nome, m.papel, m.convidado_por, m.ultimo_acesso_em
  from public.membros_familia m join public.profiles p on p.id = m.profile_id
  where m.familia_id = public.familia_do_usuario()
$$;

create or replace function public.minha_familia()
returns table (familia_id uuid, papel text, plano text, trial_fim timestamptz, cortesia_fim timestamptz, modo text)
language sql stable security definer set search_path = public as $$
  select f.id, m.papel, f.plano, f.trial_fim, f.cortesia_fim, v.modo
  from public.membros_familia m join public.familias f on f.id = m.familia_id join public.v_modo v on v.familia_id = f.id
  where m.profile_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.familias enable row level security;
alter table public.membros_familia enable row level security;
alter table public.bebes enable row level security;
alter table public.registros enable row level security;
alter table public.sintomas enable row level security;
alter table public.sintomas_catalogo enable row level security;
alter table public.consultas enable row level security;
alter table public.sessoes_chutes enable row level security;
alter table public.contracoes enable row level security;
alter table public.pos_parto_checkins enable row level security;
alter table public.conteudos enable row level security;
alter table public.conteudos_lidos enable row level security;
alter table public.convites enable row level security;
alter table public.voz_interpretacoes enable row level security;
alter table public.admins enable row level security;

create policy "perfil: só o próprio" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "perfil: nome visível para a família" on public.profiles for select using (
  exists (select 1 from public.membros_familia a join public.membros_familia b on a.familia_id = b.familia_id where a.profile_id = auth.uid() and b.profile_id = profiles.id)
);
create policy "família: membros leem" on public.familias for select using (public.eh_membro(id));
create policy "família: dona edita" on public.familias for update using (dona_id = auth.uid());
create policy "membros: membros leem" on public.membros_familia for select using (public.eh_membro(familia_id));
-- Inserção/remoção de membros só pelas RPCs (security definer).

-- Tabelas de família: leitura e escrita por qualquer membro; autor preenchido por trigger.
do $$
declare t text;
begin
  foreach t in array array['bebes', 'registros', 'consultas', 'sessoes_chutes', 'contracoes', 'conteudos_lidos']
  loop
    execute format('create policy "%1$s: membros leem" on public.%1$I for select using (public.eh_membro(familia_id))', t);
    execute format('create policy "%1$s: membros inserem" on public.%1$I for insert with check (familia_id is null or public.eh_membro(familia_id))', t);
    execute format('create policy "%1$s: membros editam" on public.%1$I for update using (public.eh_membro(familia_id))', t);
  end loop;
end $$;

-- CUI-04: só mãe e parceiro apagam registros de outros. (Soft delete = update de apagado_em.)
drop policy "registros: membros editam" on public.registros;
create policy "registros: membros editam" on public.registros for update using (
  public.eh_membro(familia_id) and (criado_por = auth.uid() or public.ve_dados_da_mae())
);

-- CUI-05: sintomas e check-ins da mãe são privados para avó e cuidador.
create policy "sintomas: leem mãe, parceiro e autor" on public.sintomas for select using (public.eh_membro(familia_id) and (criado_por = auth.uid() or public.ve_dados_da_mae()));
create policy "sintomas: inserem" on public.sintomas for insert with check (familia_id is null or public.eh_membro(familia_id));
create policy "sintomas: editam" on public.sintomas for update using (public.eh_membro(familia_id) and (criado_por = auth.uid() or public.ve_dados_da_mae()));
create policy "checkins: leem mãe, parceiro e autor" on public.pos_parto_checkins for select using (public.eh_membro(familia_id) and (criado_por = auth.uid() or public.ve_dados_da_mae()));
create policy "checkins: inserem" on public.pos_parto_checkins for insert with check (familia_id is null or public.eh_membro(familia_id));
create policy "checkins: editam" on public.pos_parto_checkins for update using (public.eh_membro(familia_id) and (criado_por = auth.uid() or public.ve_dados_da_mae()));

create policy "catálogo: todos leem" on public.sintomas_catalogo for select using (true);
create policy "conteúdo: publicado para todos" on public.conteudos for select using (publicado or public.eh_admin());
create policy "conteúdo: admin escreve" on public.conteudos for all using (public.eh_admin()) with check (public.eh_admin());
create policy "convites: quem criou lê" on public.convites for select using (criado_por = auth.uid());
create policy "voz: membros" on public.voz_interpretacoes for all using (public.eh_membro(familia_id)) with check (familia_id is null or public.eh_membro(familia_id));
create policy "admins: ninguém lê pela API" on public.admins for select using (false);

grant execute on function public.convite_publico(text) to anon, authenticated;
grant execute on function public.criar_convite(text), public.aceitar_convite(text, text), public.remover_membro(uuid), public.iniciar_cortesia(timestamptz), public.meus_membros(), public.minha_familia() to authenticated;
