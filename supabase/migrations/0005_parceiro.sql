-- Ninho · funcionalidade 12 (specs/funcionalidades/12-modo-parceiro.md): modo parceiro.
-- Mesma régua das anteriores. Desvios do modelo da spec:
--   * `pregnancy_members` é a `membros_familia` da fundação; `removed_at` vira `removido_em` (remoção suave, RN-06);
--   * as permissões ganham `birth_plan` (padrão ligado), que a funcionalidade 10 usa;
--   * a central de avisos (`avisos`) nasce aqui: RN-06 (o parceiro saiu) e, depois, o FAQ (spec 09);
--   * o parceiro deixa de ler `user_exams`: os exames marcados chegam só com nome e data pela RPC
--     `exames_marcados_parceiro` (matriz de acesso, RN-04).

-- ---------------------------------------------------------------------------
-- Membros: remoção suave e um parceiro por gestação (RN-03/06)
-- ---------------------------------------------------------------------------
alter table public.membros_familia add column removido_em timestamptz;
drop index public.membros_familia_um_por_pessoa;
create unique index membros_familia_um_por_pessoa on public.membros_familia (profile_id) where removido_em is null;
create unique index membros_familia_um_parceiro on public.membros_familia (familia_id) where papel = 'parceiro' and removido_em is null;

create or replace function public.familia_do_usuario()
returns uuid language sql stable security definer set search_path = public as $$
  select familia_id from public.membros_familia where profile_id = auth.uid() and removido_em is null limit 1
$$;

create or replace function public.papel_do_usuario()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.membros_familia where profile_id = auth.uid() and removido_em is null limit 1
$$;

create or replace function public.eh_membro(f uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros_familia where familia_id = f and profile_id = auth.uid() and removido_em is null)
$$;

create or replace function public.eh_gestante(f uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros_familia where familia_id = f and profile_id = auth.uid() and papel = 'mae' and removido_em is null)
$$;

-- RN-04/05: a permissão desligada nega na hora. Padrões: agenda e plano de parto ligados; fotos desligadas.
create or replace function public.tem_permissao(f uuid, chave text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when m.papel = 'mae' then true
      when m.papel = 'parceiro' then coalesce((m.permissoes ->> chave)::boolean, chave in ('agenda', 'birth_plan'))
      else false
    end
    from public.membros_familia m where m.familia_id = f and m.profile_id = auth.uid() and m.removido_em is null
  ), false)
$$;

create or replace function public.definir_permissoes_parceiro(p_profile_id uuid, p_permissoes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare f uuid := public.familia_do_usuario();
begin
  if public.papel_do_usuario() <> 'mae' then raise exception 'só a gestante muda as permissões'; end if;
  update public.membros_familia
     set permissoes = jsonb_build_object(
           'agenda', coalesce((p_permissoes ->> 'agenda')::boolean, true),
           'belly_photos', coalesce((p_permissoes ->> 'belly_photos')::boolean, false),
           'birth_plan', coalesce((p_permissoes ->> 'birth_plan')::boolean, true))
   where familia_id = f and profile_id = p_profile_id and papel = 'parceiro' and removido_em is null;
  if not found then raise exception 'parceiro não encontrado'; end if;
end $$;

-- Os removidos continuam na lista (com `removido_em`) para o "Escrito por {nome}" do diário (RN-06).
drop function public.meus_membros();
create function public.meus_membros()
returns table (profile_id uuid, nome text, papel text, convidado_por uuid, ultimo_acesso_em timestamptz, permissoes jsonb, removido_em timestamptz)
language sql stable security definer set search_path = public as $$
  select m.profile_id, p.nome, m.papel, m.convidado_por, m.ultimo_acesso_em, m.permissoes, m.removido_em
  from public.membros_familia m join public.profiles p on p.id = m.profile_id
  where m.familia_id = public.familia_do_usuario()
$$;

-- O parceiro (e quem mais acompanha) recebe a DPP da gestante: a semana dele é a dela.
drop function public.minha_familia();
create function public.minha_familia()
returns table (familia_id uuid, papel text, plano text, trial_fim timestamptz, cortesia_fim timestamptz, modo text, dpp date)
language sql stable security definer set search_path = public as $$
  select f.id, m.papel, f.plano, f.trial_fim, f.cortesia_fim, v.modo,
         (select g.dpp from public.membros_familia mg join public.profiles g on g.id = mg.profile_id
           where mg.familia_id = f.id and mg.papel = 'mae' and mg.removido_em is null limit 1)
  from public.membros_familia m join public.familias f on f.id = m.familia_id join public.v_modo v on v.familia_id = f.id
  where m.profile_id = auth.uid() and m.removido_em is null
$$;
grant execute on function public.meus_membros(), public.minha_familia() to authenticated;

-- ---------------------------------------------------------------------------
-- Central de avisos (sem push): RN-06 e, depois, o FAQ
-- ---------------------------------------------------------------------------
create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid references public.familias (id) on delete cascade,
  para uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tipo text not null check (char_length(tipo) <= 40),
  titulo text not null check (char_length(titulo) <= 120),
  corpo text check (char_length(corpo) <= 300),
  url text check (char_length(url) <= 200),
  lido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create index avisos_para on public.avisos (para, criado_em desc);
create trigger avisos_conflito before update on public.avisos for each row execute function public.manter_mais_recente();
alter table public.avisos enable row level security;
create policy "avisos: só a pessoa lê" on public.avisos for select using (para = auth.uid());
-- O app só marca como lido (o upsert da sincronização exige a policy de insert, limitada à própria pessoa).
create policy "avisos: a pessoa marca" on public.avisos for update using (para = auth.uid()) with check (para = auth.uid());
create policy "avisos: a pessoa grava os seus" on public.avisos for insert with check (para = auth.uid());

-- ---------------------------------------------------------------------------
-- Convite do parceiro (RN-01/02/03/10/12)
-- ---------------------------------------------------------------------------
create table public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias (id) on delete cascade,
  criado_por uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  criado_em timestamptz not null default now()
);
create unique index partner_invites_um_ativo on public.partner_invites (familia_id) where accepted_at is null and revoked_at is null;
alter table public.partner_invites enable row level security;
-- Só a gestante vê o estado dos convites da família; o token em si nunca é guardado.
create policy "convite do parceiro: gestante lê" on public.partner_invites for select using (public.eh_gestante(familia_id));

create or replace function public.estado_convite_parceiro(c public.partner_invites)
returns text language sql immutable as $$
  select case
    when c.id is null then 'inexistente'
    when c.accepted_at is not null then 'usado'
    when c.revoked_at is not null then 'revogado'
    when c.expires_at < now() then 'expirado'
    else 'valido' end
$$;

-- RN-01: só a gestante; um convite ativo por vez (gerar outro revoga o anterior); 7 dias.
-- RN-03: com parceiro ativo, nada de convite novo.
create or replace function public.criar_convite_parceiro()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  f uuid := public.familia_do_usuario();
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  token text;
  codigo text;
  expira timestamptz := now() + interval '7 days';
  i int;
begin
  if f is null or public.papel_do_usuario() <> 'mae' then raise exception 'so_a_gestante'; end if;
  if exists (select 1 from public.membros_familia where familia_id = f and papel = 'parceiro' and removido_em is null) then
    raise exception 'ja_tem_parceiro';
  end if;
  update public.partner_invites set revoked_at = now() where familia_id = f and accepted_at is null and revoked_at is null;
  token := encode(gen_random_bytes(32), 'hex');
  loop
    codigo := '';
    for i in 1..6 loop
      codigo := codigo || substr(alfabeto, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.partner_invites where code = codigo);
  end loop;
  insert into public.partner_invites (familia_id, criado_por, token_hash, code, expires_at)
    values (f, auth.uid(), encode(digest(token, 'sha256'), 'hex'), codigo, expira);
  return jsonb_build_object('token', token, 'code', codigo, 'expires_at', expira);
end $$;

create or replace function public.revogar_convite_parceiro()
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.papel_do_usuario() <> 'mae' then raise exception 'so_a_gestante'; end if;
  update public.partner_invites set revoked_at = now() where familia_id = public.familia_do_usuario() and accepted_at is null and revoked_at is null;
end $$;

create or replace function public.achar_convite_parceiro(p_token text, p_code text)
returns public.partner_invites language sql stable security definer set search_path = public, extensions as $$
  select * from public.partner_invites
   where (p_token is not null and token_hash = encode(digest(p_token, 'sha256'), 'hex'))
      or (p_code is not null and code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g')))
   limit 1
$$;
revoke execute on function public.achar_convite_parceiro(text, text) from public, anon, authenticated;

-- Tela 2: o que ele vai ver antes de aceitar (só o nome de quem convidou). RN-12: estado claro.
create or replace function public.convite_parceiro_publico(p_token text default null, p_code text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.partner_invites;
  quem text;
begin
  c := public.achar_convite_parceiro(p_token, p_code);
  if c.id is null then return jsonb_build_object('estado', 'inexistente'); end if;
  select nome into quem from public.profiles where id = c.criado_por;
  return jsonb_build_object('estado', public.estado_convite_parceiro(c), 'quem', coalesce(quem, 'Alguém'));
end $$;

-- RN-02: exige login de verdade (não anônimo) e uma conta tem um papel por vez.
create or replace function public.aceitar_convite_parceiro(p_token text default null, p_code text default null, p_nome text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.partner_invites;
  atual public.membros_familia;
  horas numeric;
begin
  if auth.uid() is null then raise exception 'sem_sessao'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'precisa_login'; end if;
  c := public.achar_convite_parceiro(p_token, p_code);
  if c.id is null then raise exception 'inexistente'; end if;
  perform 1 from public.partner_invites where id = c.id for update;
  if public.estado_convite_parceiro(c) <> 'valido' then raise exception '%', public.estado_convite_parceiro(c); end if;

  select * into atual from public.membros_familia where profile_id = auth.uid() and removido_em is null;
  if atual.familia_id = c.familia_id then raise exception 'ja_e_membro'; end if;
  if atual.papel = 'parceiro'
     or (atual.papel = 'mae' and (exists (select 1 from public.profiles where id = auth.uid() and onboarding_concluido_em is not null)
                                  or exists (select 1 from public.bebes where familia_id = atual.familia_id)
                                  or exists (select 1 from public.membros_familia where familia_id = atual.familia_id and profile_id <> auth.uid() and removido_em is null))) then
    raise exception 'outra_conta';
  end if;
  if exists (select 1 from public.membros_familia where familia_id = c.familia_id and papel = 'parceiro' and removido_em is null) then
    raise exception 'ja_tem_parceiro';
  end if;

  -- A família vazia criada no primeiro login sai (nada registrado nela).
  if atual.familia_id is not null then
    delete from public.membros_familia where familia_id = atual.familia_id and profile_id = auth.uid();
    if not exists (select 1 from public.membros_familia where familia_id = atual.familia_id) then
      delete from public.familias where id = atual.familia_id;
    end if;
  end if;

  insert into public.membros_familia (familia_id, profile_id, papel, convidado_por, permissoes)
    values (c.familia_id, auth.uid(), 'parceiro', c.criado_por, '{"agenda": true, "birth_plan": true, "belly_photos": false}')
  on conflict (familia_id, profile_id) do update
    set papel = 'parceiro', removido_em = null, convidado_por = excluded.convidado_por, permissoes = excluded.permissoes, ultimo_acesso_em = now();
  update public.partner_invites set accepted_by = auth.uid(), accepted_at = now() where id = c.id;
  if nullif(trim(p_nome), '') is not null then update public.profiles set nome = trim(p_nome), atualizado_em = now() where id = auth.uid(); end if;
  horas := round(extract(epoch from now() - c.criado_em) / 3600.0, 1);
  return jsonb_build_object('familia_id', c.familia_id, 'horas', horas);
end $$;

-- RN-06: sai da gestação; o diário dele fica com ela; push dele apagado; aviso na central dela, sem push.
create or replace function public.encerrar_parceiro(f uuid, p uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.membros_familia set removido_em = now() where familia_id = f and profile_id = p and removido_em is null;
  delete from public.push_subscriptions where profile_id = p;
  -- Sem família ativa, a pessoa volta a ter uma só dela (o próximo login não quebra).
  if not exists (select 1 from public.membros_familia where profile_id = p and removido_em is null) then
    with nova as (insert into public.familias (dona_id) values (p) returning id)
    insert into public.membros_familia (familia_id, profile_id, papel) select id, p, 'mae' from nova;
  end if;
end $$;
revoke execute on function public.encerrar_parceiro(uuid, uuid) from public, anon, authenticated;

create or replace function public.sair_da_gestacao()
returns void language plpgsql security definer set search_path = public as $$
declare
  m public.membros_familia;
  nome text;
  gestante uuid;
begin
  select * into m from public.membros_familia where profile_id = auth.uid() and removido_em is null;
  if m.papel is distinct from 'parceiro' then raise exception 'so_o_parceiro'; end if;
  select coalesce(p.nome, 'Seu parceiro') into nome from public.profiles p where p.id = auth.uid();
  select profile_id into gestante from public.membros_familia where familia_id = m.familia_id and papel = 'mae' and removido_em is null limit 1;
  perform public.encerrar_parceiro(m.familia_id, auth.uid());
  if gestante is not null then
    insert into public.avisos (familia_id, para, tipo, titulo, corpo, url)
      values (m.familia_id, gestante, 'partner_left', nome || ' saiu da gestação', 'O que ele escreveu no diário continua com você.', '/eu/parceiro');
  end if;
end $$;

-- CUI-08 + RN-06: remover é suave para o parceiro (o nome segue no diário); os outros papéis saem como antes.
create or replace function public.remover_membro(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  f uuid := public.familia_do_usuario();
  alvo public.membros_familia;
begin
  if public.papel_do_usuario() <> 'mae' then raise exception 'só a dona remove'; end if;
  if p_profile_id = auth.uid() then raise exception 'não dá para se remover'; end if;
  select * into alvo from public.membros_familia where familia_id = f and profile_id = p_profile_id and removido_em is null;
  if alvo.papel = 'parceiro' then
    perform public.encerrar_parceiro(f, p_profile_id);
  else
    delete from public.membros_familia where familia_id = f and profile_id = p_profile_id;
  end if;
end $$;

grant execute on function public.criar_convite_parceiro(), public.revogar_convite_parceiro(), public.convite_parceiro_publico(text, text),
  public.aceitar_convite_parceiro(text, text, text), public.sair_da_gestacao(), public.remover_membro(uuid) to authenticated;
grant execute on function public.convite_parceiro_publico(text, text) to anon;

-- ---------------------------------------------------------------------------
-- Matriz de acesso (RN-04): exames feitos nunca; marcados só com nome e data
-- ---------------------------------------------------------------------------
drop policy "exames: leem" on public.user_exams;
drop policy "exames: inserem" on public.user_exams;
drop policy "exames: editam" on public.user_exams;
create policy "exames: gestante lê" on public.user_exams for select using (public.eh_gestante(familia_id));
create policy "exames: gestante insere" on public.user_exams for insert with check (familia_id is null or public.eh_gestante(familia_id));
create policy "exames: gestante edita" on public.user_exams for update using (public.eh_gestante(familia_id));

create or replace function public.exames_marcados_parceiro()
returns table (id uuid, catalog_code text, custom_name text, scheduled_at timestamptz, scheduled_all_day boolean, atualizado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, e.catalog_code, e.custom_name, e.scheduled_at, e.scheduled_all_day, e.atualizado_em
    from public.user_exams e
   where e.familia_id = public.familia_do_usuario()
     and e.status = 'scheduled' and e.apagado_em is null
     and public.tem_permissao(e.familia_id, 'agenda')
$$;
grant execute on function public.exames_marcados_parceiro() to authenticated;

-- ---------------------------------------------------------------------------
-- "Como ajudar esta semana" (RN-09): conteúdo, lido por todos, escrito pelo painel
-- ---------------------------------------------------------------------------
create table public.partner_tips (
  id uuid primary key default gen_random_uuid(),
  week_from smallint not null check (week_from between 1 and 42),
  week_to smallint not null check (week_to between week_from and 42),
  trimester smallint not null check (trimester between 1 and 3),
  feeling_text text not null check (char_length(feeling_text) <= 160),
  help_tips text[] not null check (cardinality(help_tips) between 1 and 3),
  reviewed_on date,
  atualizado_em timestamptz not null default now(),
  unique (week_from, week_to)
);
alter table public.partner_tips enable row level security;
create policy "dicas: todos leem" on public.partner_tips for select using (true);
create policy "dicas: admin escreve" on public.partner_tips for all using (public.eh_admin()) with check (public.eh_admin());

-- RN-08: os avisos do parceiro entram no mesmo registro do que já saiu (a chave leva o id dele).
alter table public.reminders_sent drop constraint reminders_sent_categoria_check;
alter table public.reminders_sent add constraint reminders_sent_categoria_check check (categoria in ('med', 'exam', 'appt', 'belly', 'diary', 'partner'));
