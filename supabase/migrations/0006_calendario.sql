-- Ninho · funcionalidade 08 (specs/funcionalidades/08-calendario.md): calendário.
-- Mesma régua das anteriores. Desvios do modelo da spec:
--   * `calendar_items_v` une só o que o feed iCal publica (consultas, exames marcados, eventos próprios e DPP).
--     O resumo diário de medicamentos e a virada de semana da foto são derivados no app (`@dominio/calendario.ts`),
--     das mesmas tabelas, e nunca saem no feed (RN-08);
--   * o token do feed fica guardado (é o link que ela compartilha); revogar marca `revoked_at` e gera outro.

create table public.calendar_events (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  category text not null default 'other' check (category in ('exam', 'appointment', 'course', 'purchase', 'other')),
  starts_at timestamptz,
  all_day boolean not null default false,
  all_day_date date,
  notes text check (char_length(notes) <= 500),
  remind_offset_minutes int check (remind_offset_minutes in (0, 60, 1440)),
  visible_to_partner boolean not null default true,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  -- RN-06: dia inteiro sem hora; senão, a hora é obrigatória.
  check ((all_day and all_day_date is not null and starts_at is null) or (not all_day and starts_at is not null and all_day_date is null))
);
create index calendar_events_periodo on public.calendar_events (familia_id, coalesce(all_day_date, (starts_at at time zone 'UTC')::date)) where apagado_em is null;

create table public.calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias (id) on delete cascade,
  token text not null unique check (token ~ '^[a-f0-9]{48}$'),
  criado_em timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index calendar_feed_tokens_um_ativo on public.calendar_feed_tokens (familia_id) where revoked_at is null;

do $$
declare t text := 'calendar_events';
begin
  execute format('create trigger %I_familia before insert on public.%I for each row execute function public.preencher_familia()', t, t);
  execute format('create trigger %I_autor before insert on public.%I for each row execute function public.preencher_autor()', t, t);
  execute format('create trigger %I_conflito before update on public.%I for each row execute function public.manter_mais_recente()', t, t);
end $$;

alter table public.calendar_events enable row level security;
alter table public.calendar_feed_tokens enable row level security;

-- RN-11: o parceiro (com `agenda`) vê os eventos marcados como visíveis; quem cria e edita é a gestante.
create policy "eventos: leem" on public.calendar_events for select using (
  public.eh_gestante(familia_id) or (visible_to_partner and public.tem_permissao(familia_id, 'agenda') and public.papel_do_usuario() = 'parceiro')
);
create policy "eventos: gestante insere" on public.calendar_events for insert with check (familia_id is null or public.eh_gestante(familia_id));
create policy "eventos: gestante edita" on public.calendar_events for update using (public.eh_gestante(familia_id));
create policy "feed: gestante lê" on public.calendar_feed_tokens for select using (public.eh_gestante(familia_id));

-- RN-08: um link ativo por gestação; gerar de novo devolve o mesmo; revogar invalida e gera outro.
create or replace function public.feed_calendario(p_novo boolean default false)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  f uuid := public.familia_do_usuario();
  t text;
begin
  if f is null or not public.eh_gestante(f) then raise exception 'so_a_gestante'; end if;
  if p_novo then
    update public.calendar_feed_tokens set revoked_at = now() where familia_id = f and revoked_at is null;
  else
    select token into t from public.calendar_feed_tokens where familia_id = f and revoked_at is null;
    if t is not null then return t; end if;
  end if;
  t := encode(gen_random_bytes(24), 'hex');
  insert into public.calendar_feed_tokens (familia_id, token) values (f, t);
  return t;
end $$;

create or replace function public.revogar_feed_calendario()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_gestante(public.familia_do_usuario()) then raise exception 'so_a_gestante'; end if;
  update public.calendar_feed_tokens set revoked_at = now() where familia_id = public.familia_do_usuario() and revoked_at is null;
end $$;
grant execute on function public.feed_calendario(boolean), public.revogar_feed_calendario() to authenticated;

-- O que o feed publica (RN-08): consultas marcadas, exames marcados, eventos próprios e a DPP.
-- Sem notas, medicamentos nem fotos. Só a Edge Function (service role) lê a view por token.
create view public.calendar_items_v with (security_invoker = true) as
  select a.familia_id, 'appointment'::text as item_type, a.id::text as item_id,
         coalesce(nullif(a.provider_name, ''), 'Consulta') as title, a.location, a.starts_at, false as all_day, null::date as all_day_date,
         'primaria'::text as color_key, '/consultas/' || a.id as deep_link
    from public.appointments a where a.status = 'scheduled' and a.apagado_em is null
  union all
  select e.familia_id, 'exam', e.id::text, coalesce(e.custom_name, e.catalog_code, 'Exame'), null, e.scheduled_at, e.scheduled_all_day,
         case when e.scheduled_all_day then (e.scheduled_at at time zone coalesce(p.tz, 'America/Sao_Paulo'))::date end,
         'acento', '/exames/' || e.id
    from public.user_exams e
    left join public.membros_familia m on m.familia_id = e.familia_id and m.papel = 'mae' and m.removido_em is null
    left join public.profiles p on p.id = m.profile_id
   where e.status = 'scheduled' and e.scheduled_at is not null and e.apagado_em is null
  union all
  select c.familia_id, 'custom', c.id::text, c.title, null, c.starts_at, c.all_day, c.all_day_date, 'sono', '/calendario/evento?id=' || c.id
    from public.calendar_events c where c.apagado_em is null
  union all
  select m.familia_id, 'edd', m.familia_id::text, 'Data provável do parto', null, null, true, p.dpp, 'sucesso', '/hoje'
    from public.membros_familia m join public.profiles p on p.id = m.profile_id
   where m.papel = 'mae' and m.removido_em is null and p.dpp is not null and p.modo = 'gestacao';
revoke all on public.calendar_items_v from anon, authenticated;

-- RN-06: lembrete de evento próprio entra no mesmo registro do que já saiu.
alter table public.reminders_sent drop constraint reminders_sent_categoria_check;
alter table public.reminders_sent add constraint reminders_sent_categoria_check check (categoria in ('med', 'exam', 'appt', 'belly', 'diary', 'partner', 'calendar'));
