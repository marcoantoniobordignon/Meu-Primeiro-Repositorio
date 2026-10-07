-- Funcionalidade 14 · Cartas para o bebê: rascunho, lacre que vale no banco, abertura na data, link de leitura.
--
-- Decisões (também no CHANGELOG):
--   * "pregnancy" é a família (`familia_id`); a autora é `author_id` (cada autor vê só as próprias: RN-09).
--   * Lacre de verdade (RN-03): o app não tem SELECT na tabela. Lê pela view `letters_visible`, que devolve título,
--     data e estado sempre, e texto, áudio e foto só fora do lacre. Escrita só pelas funções abaixo (o app as chama
--     pela fila offline: `salvar_carta`), que validam as regras. O Storage segue a mesma regra (áudio e foto de carta
--     lacrada não são lidos nem pelo autor).
--   * `open_on` é calculada no banco ao lacrar (RN-02), a partir do nascimento (ou da DPP, até ele) e recalculada
--     quando o nascimento é registrado ou a DPP muda.
--   * Plano (RN-07) checado no banco: free tem 2 cartas por autor, só texto; as que existem sobrevivem ao downgrade.
--   * Excluir (RN-08) apaga o conteúdo na hora; o job tira o áudio e a foto do Storage.

create table public.letters (
  id uuid primary key,
  familia_id uuid not null references public.familias (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  body text check (char_length(body) <= 5000),
  audio_path text,
  audio_seconds smallint check (audio_seconds between 1 and 300),
  photo_path text,
  open_rule text check (open_rule in ('first_birthday', 'age_5', 'age_10', 'age_15', 'age_18', 'custom')),
  custom_open_on date,
  open_on date,
  status text not null default 'draft' check (status in ('draft', 'sealed', 'opened')),
  sealed_at timestamptz,
  opened_at timestamptz,
  unsealed_at timestamptz,
  delivery_email text check (delivery_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(delivery_email) <= 200),
  -- Job (RN-05/11): o que já saiu, para não repetir.
  opened_notified_at timestamptz,
  delivery_sent_at timestamptz,
  storage_cleanup_pending boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  check (status = 'draft' or open_on is not null),
  check ((audio_path is null) = (audio_seconds is null))
);
create index letters_abrir on public.letters (open_on) where status = 'sealed' and apagado_em is null;

create table public.letter_share_tokens (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.letters (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  views int not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.letters enable row level security;
alter table public.letter_share_tokens enable row level security;
-- Sem policy e sem privilégio: tudo passa pela view e pelas funções.
revoke all on public.letters, public.letter_share_tokens from anon, authenticated;

-- RN-03/09: a autora vê título e data sempre; texto, áudio e foto só fora do lacre.
create view public.letters_visible as
  select id, familia_id, author_id, title,
         case when status <> 'sealed' then body end as body,
         case when status <> 'sealed' then audio_path end as audio_path,
         case when status <> 'sealed' then audio_seconds end as audio_seconds,
         case when status <> 'sealed' then photo_path end as photo_path,
         open_rule, custom_open_on, open_on, status, sealed_at, opened_at, unsealed_at, delivery_email,
         created_at, updated_at, atualizado_em, apagado_em
  from public.letters
  where author_id = auth.uid();
grant select on public.letters_visible to authenticated;

-- ---------------------------------------------------------------------------
-- Regras puras
-- ---------------------------------------------------------------------------
create or replace function public.familia_premium(f uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.familias where id = f and (plano in ('ativo', 'trial') or cortesia_fim > now()))
$$;

-- RN-02: referência = primeiro nascimento da família; antes dele, a DPP da gestante.
create or replace function public.referencia_das_cartas(f uuid)
returns date language sql stable security definer set search_path = public as $$
  select coalesce(
    (select min((b.nascido_em at time zone coalesce(p.tz, 'America/Sao_Paulo'))::date)
       from public.bebes b
       left join public.membros_familia m on m.familia_id = b.familia_id and m.papel = 'mae' and m.removido_em is null
       left join public.profiles p on p.id = m.profile_id
      where b.familia_id = f and b.apagado_em is null),
    (select g.dpp from public.membros_familia m join public.profiles g on g.id = m.profile_id
      where m.familia_id = f and m.papel = 'mae' and m.removido_em is null limit 1)
  )
$$;

create or replace function public.data_de_abertura(p_rule text, p_referencia date, p_custom date)
returns date language sql immutable as $$
  select case p_rule
    when 'first_birthday' then (p_referencia + interval '1 year')::date
    when 'age_5' then (p_referencia + interval '5 years')::date
    when 'age_10' then (p_referencia + interval '10 years')::date
    when 'age_15' then (p_referencia + interval '15 years')::date
    when 'age_18' then (p_referencia + interval '18 years')::date
    when 'custom' then p_custom
  end
$$;

create or replace function public.minha_familia_de_cartas()
returns uuid language sql stable security definer set search_path = public as $$
  select familia_id from public.membros_familia where profile_id = auth.uid() and papel in ('mae', 'parceiro') and removido_em is null limit 1
$$;

-- ---------------------------------------------------------------------------
-- Escrita (pela fila offline): rascunho novo, edição de rascunho, exclusão
-- ---------------------------------------------------------------------------
create or replace function public.salvar_carta(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_atual public.letters;
  v_familia uuid;
  v_premium boolean;
  v_quando timestamptz := coalesce((p ->> 'atualizado_em')::timestamptz, now());
begin
  v_familia := public.minha_familia_de_cartas();
  if v_familia is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into v_atual from public.letters where id = v_id;
  if found and v_atual.author_id <> auth.uid() then raise exception 'sem_permissao' using errcode = '42501'; end if;

  -- RN-08: excluir é definitivo (o conteúdo some agora; áudio e foto saem do Storage pelo job).
  if p ->> 'apagado_em' is not null then
    if found and v_atual.apagado_em is null then
      update public.letters set apagado_em = now(), atualizado_em = greatest(now(), v_quando), body = null,
        storage_cleanup_pending = (audio_path is not null or photo_path is not null), delivery_email = null where id = v_id;
      update public.letter_share_tokens set revoked_at = now() where letter_id = v_id and revoked_at is null;
    end if;
    return;
  end if;

  -- A fila manda a versão mais recente por último; uma mais velha não pisa na nova.
  if found and v_atual.atualizado_em > v_quando then return; end if;
  if found and v_atual.apagado_em is not null then return; end if;
  -- RN-03: lacrada não muda (desfazer o lacre é outra função); aberta é para ler.
  if found and v_atual.status <> 'draft' then raise exception 'carta_lacrada'; end if;

  v_premium := public.familia_premium(v_familia);
  if (p ->> 'audio_path' is not null or p ->> 'photo_path' is not null) and not v_premium
     and (not found or p ->> 'audio_path' is distinct from v_atual.audio_path or p ->> 'photo_path' is distinct from v_atual.photo_path) then
    raise exception 'premium';
  end if;
  if not found and not v_premium and (select count(*) from public.letters where author_id = auth.uid() and apagado_em is null) >= 2 then
    raise exception 'limite_cartas';
  end if;
  if p ->> 'audio_path' is not null and p ->> 'audio_path' not like 'cartas/' || v_id || '/%' then raise exception 'caminho_invalido'; end if;
  if p ->> 'photo_path' is not null and p ->> 'photo_path' not like 'cartas/' || v_id || '/%' then raise exception 'caminho_invalido'; end if;

  insert into public.letters (id, familia_id, author_id, title, body, audio_path, audio_seconds, photo_path, open_rule, custom_open_on, delivery_email, created_at, atualizado_em)
  values (v_id, v_familia, auth.uid(), p ->> 'title', nullif(p ->> 'body', ''), p ->> 'audio_path', (p ->> 'audio_seconds')::smallint, p ->> 'photo_path',
          p ->> 'open_rule', (p ->> 'custom_open_on')::date, nullif(trim(p ->> 'delivery_email'), ''), coalesce((p ->> 'created_at')::timestamptz, now()), v_quando)
  on conflict (id) do update set
    title = excluded.title, body = excluded.body, audio_path = excluded.audio_path, audio_seconds = excluded.audio_seconds,
    photo_path = excluded.photo_path, open_rule = excluded.open_rule, custom_open_on = excluded.custom_open_on,
    delivery_email = excluded.delivery_email, updated_at = now(), atualizado_em = excluded.atualizado_em;
end $$;

-- RN-01/02/03: lacrar pede título, texto ou áudio, regra válida, os arquivos já no Storage e a versão sincronizada.
create or replace function public.lacrar_carta(p_id uuid, p_atualizado_em timestamptz)
returns date language plpgsql security definer set search_path = public, storage as $$
declare
  v public.letters;
  v_abre date;
  v_hoje date := current_date;
begin
  select * into v from public.letters where id = p_id and author_id = auth.uid() and apagado_em is null;
  if not found then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if v.status <> 'draft' then raise exception 'carta_lacrada'; end if;
  if v.atualizado_em < p_atualizado_em then raise exception 'nao_sincronizado'; end if;
  if nullif(trim(coalesce(v.body, '')), '') is null and v.audio_path is null then raise exception 'sem_conteudo'; end if;
  if v.open_rule is null then raise exception 'sem_regra'; end if;
  if (v.audio_path is not null and not exists (select 1 from storage.objects where bucket_id = 'ninho-privado' and name = v.audio_path))
     or (v.photo_path is not null and not exists (select 1 from storage.objects where bucket_id = 'ninho-privado' and name = v.photo_path)) then
    raise exception 'arquivo_pendente';
  end if;
  v_abre := public.data_de_abertura(v.open_rule, public.referencia_das_cartas(v.familia_id), v.custom_open_on);
  if v.open_rule = 'custom' and (v_abre is null or v_abre < v_hoje + 180 or v_abre > (v_hoje + interval '30 years')::date) then raise exception 'data_invalida'; end if;
  if v_abre is null then raise exception 'sem_referencia'; end if;
  update public.letters set status = 'sealed', open_on = v_abre, sealed_at = now(), updated_at = now(), atualizado_em = now() where id = p_id;
  return v_abre;
end $$;

-- RN-04: desfazer o lacre (o app pede confirmação dupla) volta a rascunho e devolve o conteúdo.
create or replace function public.deslacrar_carta(p_id uuid)
returns setof public.letters_visible language plpgsql security definer set search_path = public as $$
begin
  update public.letters set status = 'draft', open_on = null, unsealed_at = now(), sealed_at = null, updated_at = now(), atualizado_em = now()
    where id = p_id and author_id = auth.uid() and status = 'sealed' and apagado_em is null;
  if not found then raise exception 'carta_nao_lacrada'; end if;
  return query select * from public.letters_visible where id = p_id;
end $$;

-- RN-06: link de leitura (32 bytes; só o hash fica), 30 dias, para carta aberta. Gerar outro revoga o anterior.
create or replace function public.criar_link_carta(p_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text := encode(gen_random_bytes(32), 'hex');
begin
  if not exists (select 1 from public.letters where id = p_id and author_id = auth.uid() and status = 'opened' and apagado_em is null) then
    raise exception 'carta_nao_aberta';
  end if;
  update public.letter_share_tokens set revoked_at = now() where letter_id = p_id and revoked_at is null;
  insert into public.letter_share_tokens (letter_id, token_hash, expires_at) values (p_id, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '30 days');
  return v_token;
end $$;

create or replace function public.revogar_link_carta(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.letters where id = p_id and author_id = auth.uid()) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  update public.letter_share_tokens set revoked_at = now() where letter_id = p_id and revoked_at is null;
end $$;

-- Leitura pública (pela Edge Function, com a service role): só a carta, nada da gestação.
create or replace function public.carta_por_token(p_token text)
returns table (title text, body text, audio_path text, photo_path text) language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token public.letter_share_tokens;
begin
  select * into v_token from public.letter_share_tokens where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if not found or v_token.revoked_at is not null or v_token.expires_at < now() then return; end if;
  update public.letter_share_tokens set views = views + 1 where id = v_token.id;
  return query select l.title, l.body, l.audio_path, l.photo_path from public.letters l
    where l.id = v_token.letter_id and l.status = 'opened' and l.apagado_em is null;
end $$;

revoke all on function public.salvar_carta(jsonb), public.lacrar_carta(uuid, timestamptz), public.deslacrar_carta(uuid), public.criar_link_carta(uuid), public.revogar_link_carta(uuid), public.carta_por_token(text) from public;
grant execute on function public.salvar_carta(jsonb), public.lacrar_carta(uuid, timestamptz), public.deslacrar_carta(uuid), public.criar_link_carta(uuid), public.revogar_link_carta(uuid) to authenticated;
grant execute on function public.carta_por_token(text) to service_role;

-- RN-02: registrar o nascimento (ou mudar a DPP) recalcula a data das lacradas por regra.
create or replace function public.recalcular_aberturas(f uuid)
returns void language sql security definer set search_path = public as $$
  update public.letters set open_on = public.data_de_abertura(open_rule, public.referencia_das_cartas(f), custom_open_on), updated_at = now(), atualizado_em = now()
   where familia_id = f and status = 'sealed' and open_rule <> 'custom' and apagado_em is null
     and open_on is distinct from public.data_de_abertura(open_rule, public.referencia_das_cartas(f), custom_open_on)
$$;
create or replace function public.bebes_recalcular_cartas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalcular_aberturas(coalesce(new.familia_id, old.familia_id));
  return null;
end $$;
create trigger bebes_cartas after insert or update of nascido_em, apagado_em on public.bebes for each row execute function public.bebes_recalcular_cartas();
create or replace function public.profiles_recalcular_cartas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f uuid;
begin
  for f in select familia_id from public.membros_familia where profile_id = new.id and papel = 'mae' and removido_em is null loop
    perform public.recalcular_aberturas(f);
  end loop;
  return null;
end $$;
create trigger profiles_cartas after update of dpp on public.profiles for each row when (new.dpp is distinct from old.dpp) execute function public.profiles_recalcular_cartas();

-- Storage: áudio e foto de carta só para a autora, e nunca enquanto lacrada; sobem só para rascunho dela.
create or replace function public.arquivo_de_carta(nome text, p_gravar boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.letters
     where (audio_path = nome or photo_path = nome) and author_id = auth.uid() and apagado_em is null
       and (case when p_gravar then status = 'draft' else status <> 'sealed' end)
  )
$$;
create or replace function public.arquivo_visivel(nome text)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.belly_photos where storage_path = nome)
      or exists (select 1 from public.diary_photos where storage_path = nome)
      or exists (select 1 from public.diary_entries where audio_path = nome)
      or exists (select 1 from public.document_pages where storage_path = nome)
      or exists (select 1 from public.birth_item_attachments where storage_path = nome)
      or (nome like 'cartas/%' and public.arquivo_de_carta(nome, false))
$$;
create or replace function public.arquivo_gravavel(nome text)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.belly_photos where storage_path = nome and criado_por = auth.uid())
      or exists (select 1 from public.diary_photos f join public.diary_entries e on e.id = f.entry_id where f.storage_path = nome and e.criado_por = auth.uid())
      or exists (select 1 from public.diary_entries where audio_path = nome and criado_por = auth.uid())
      or exists (select 1 from public.document_pages where storage_path = nome and criado_por = auth.uid())
      or exists (select 1 from public.birth_item_attachments where storage_path = nome and criado_por = auth.uid())
      or (nome like 'cartas/%' and public.arquivo_de_carta(nome, true))
$$;

-- RN-05/11: push `letter_open` e o e-mail anual entram no mesmo registro de envios.
alter table public.reminders_sent drop constraint reminders_sent_categoria_check;
alter table public.reminders_sent add constraint reminders_sent_categoria_check check (categoria in ('med', 'exam', 'appt', 'belly', 'diary', 'partner', 'calendar', 'birth_plan', 'faq', 'trimester', 'faith', 'letter'));
