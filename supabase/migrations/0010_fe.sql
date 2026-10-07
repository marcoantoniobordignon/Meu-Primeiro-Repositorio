-- Funcionalidade 17 · Modo fé (católico): orações revisadas, favoritos, contadores anônimos e o lembrete do batismo.
--
-- Decisões (também no CHANGELOG):
--   * A chave do modo continua em `profiles.prefs.faith_mode` (onde o diário, spec 06, já lê) em vez de uma coluna nova:
--     uma fonte só, que já sincroniza; padrão false (RN-01). A oração no push é `prefs.faith_weekly_push` (padrão false).
--   * `reviewed_by`/`reviewed_on` podem ficar vazios no rascunho; publicar exige fonte, revisor e data (RN-05), como no FAQ.
--   * Favoritos ficam em `faith_favorites` (a spec pede favoritar e não define a tabela); desligar o modo não apaga nada (RN-02).
--   * RN-10: religião é dado sensível. Métricas só em `anon_counters` (dia, chave, contagem), sem usuário, por RPC.
--   * O batismo usa `birth_checklist_items` com list = 'baptism' (spec 10), criado no aparelho ao registrar o nascimento.

create table public.faith_prayers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null check (kind in ('weekly', 'fixed', 'intercessor', 'blessing')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 1200),
  week smallint check (week between 1 and 40),
  saint_name text,
  saint_day text check (saint_day ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  source_label text not null check (char_length(trim(source_label)) > 0),
  reviewed_by text,
  reviewed_on date,
  position int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- RN-03: a semanal tem semana; as outras, não.
  constraint faith_prayers_semana check ((kind = 'weekly') = (week is not null)),
  -- RN-05: publicado só com revisão.
  constraint faith_prayers_revisao check (status <> 'published' or (nullif(trim(reviewed_by), '') is not null and reviewed_on is not null))
);
-- RN-03: uma oração publicada por semana.
create unique index faith_prayers_uma_por_semana on public.faith_prayers (week) where kind = 'weekly' and status = 'published';

create or replace function public.faith_prayers_carimbar()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
create trigger faith_prayers_carimbo before insert or update on public.faith_prayers for each row execute function public.faith_prayers_carimbar();

create table public.faith_favorites (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  prayer_id uuid not null references public.faith_prayers (id) on delete cascade,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  unique (user_id, prayer_id)
);
create trigger faith_favorites_conflito before update on public.faith_favorites for each row execute function public.manter_mais_recente();

alter table public.faith_prayers enable row level security;
alter table public.faith_favorites enable row level security;
create policy "orações: publicado para todos" on public.faith_prayers for select using (status = 'published' or public.eh_revisor());
create policy "orações: revisor escreve" on public.faith_prayers for all using (public.eh_revisor()) with check (public.eh_revisor());
-- Ninguém além da própria pessoa vê o que ela favoritou (nem o parceiro).
create policy "favoritos de fé: os meus" on public.faith_favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RN-10: contadores anônimos (sem user_id, sem família, sem hora: só o dia).
-- ---------------------------------------------------------------------------
create table public.anon_counters (
  dia date not null,
  chave text not null check (chave in ('faith_on', 'faith_off', 'prayer_viewed', 'library_opened', 'verbum_link_tapped')),
  contagem bigint not null default 0 check (contagem >= 0),
  primary key (dia, chave)
);
alter table public.anon_counters enable row level security;
-- Sem policy: o app não lê nem escreve direto; só soma pela RPC abaixo. O painel lê com a service role.

create or replace function public.somar_contadores_anonimos(p_itens jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  v_dia date;
  v_n int;
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 50 then
    raise exception 'itens_invalidos';
  end if;
  for item in select * from jsonb_array_elements(p_itens) loop
    v_dia := (item ->> 'dia')::date;
    v_n := (item ->> 'n')::int;
    -- Só os últimos 30 dias e no máximo 100 por chave e dia de cada envio: contador, não arma.
    if v_dia is null or v_dia > current_date + 1 or v_dia < current_date - 30 or v_n is null or v_n < 1 or v_n > 100 then
      raise exception 'itens_invalidos';
    end if;
    insert into public.anon_counters (dia, chave, contagem) values (v_dia, item ->> 'chave', v_n)
      on conflict (dia, chave) do update set contagem = anon_counters.contagem + excluded.contagem;
  end loop;
end $$;
revoke all on function public.somar_contadores_anonimos(jsonb) from public;
grant execute on function public.somar_contadores_anonimos(jsonb) to anon, authenticated;

-- RN-07/08: `faith_baptism_nudge` e a oração da semana no `week_turn` (categoria própria nos envios).
alter table public.reminders_sent drop constraint reminders_sent_categoria_check;
alter table public.reminders_sent add constraint reminders_sent_categoria_check check (categoria in ('med', 'exam', 'appt', 'belly', 'diary', 'partner', 'calendar', 'birth_plan', 'faq', 'trimester', 'faith'));
