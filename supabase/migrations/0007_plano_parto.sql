-- Ninho · funcionalidade 10 (specs/funcionalidades/10-plano-parto.md): plano de parto, malas e enxoval.
-- Mesma régua das anteriores. Desvios do modelo da spec:
--   * `updated_at` vira `atualizado_em`; as tabelas ganham `criado_por`/`criado_em`/`apagado_em` (fila offline e RN-10);
--   * o plano tem um por gestação (`familia_id` único); o app cria com id determinístico, então dois aparelhos
--     não duplicam, e copia as sementes das listas na mesma hora (RN-06);
--   * anexos moram no bucket privado `ninho-privado` com a mesma regra de visibilidade da linha.

create table public.birth_plans (
  id uuid primary key,
  familia_id uuid unique references public.familias (id) on delete cascade,
  maternity_name text check (char_length(maternity_name) <= 80),
  maternity_address text check (char_length(maternity_address) <= 160),
  maternity_phone text check (char_length(maternity_phone) <= 30),
  maternity_maps_url text check (char_length(maternity_maps_url) <= 500),
  coverage text check (coverage in ('sus', 'private', 'unknown')),
  insurer_name text check (char_length(insurer_name) <= 80),
  doctor_name text check (char_length(doctor_name) <= 80),
  doctor_phone text check (char_length(doctor_phone) <= 30),
  wished_delivery text not null default 'undecided' check (wished_delivery in ('vaginal', 'cesarean', 'open', 'undecided')),
  prefs jsonb not null default '{}'::jsonb,
  notes text check (char_length(notes) <= 1000),
  companion_name text check (char_length(companion_name) <= 80),
  companion_phone text check (char_length(companion_phone) <= 30),
  doula_name text check (char_length(doula_name) <= 80),
  doula_phone text check (char_length(doula_phone) <= 30),
  emergency_name text check (char_length(emergency_name) <= 80),
  emergency_phone text check (char_length(emergency_phone) <= 30),
  completed_steps smallint[] not null default '{}' check (completed_steps <@ array[1, 2, 3, 4, 5]::smallint[]),
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  check (prefs ->> 'analgesia' is null or prefs ->> 'analgesia' in ('none', 'epidural', 'open', 'undecided')),
  check (prefs ->> 'photos_video' is null or prefs ->> 'photos_video' in ('allowed', 'no'))
);

create table public.birth_checklist_items (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  list text not null check (list in ('documents', 'bag_mother', 'bag_baby', 'bag_companion', 'layette', 'baptism')),
  title text not null check (char_length(trim(title)) between 1 and 80),
  quantity smallint check (quantity between 1 and 99),
  note text check (char_length(note) <= 120),
  is_done boolean not null default false,
  is_custom boolean not null default false,
  position int not null default 0,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create index birth_checklist_items_lista on public.birth_checklist_items (familia_id, list, position) where apagado_em is null;

create table public.birth_item_attachments (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  item_id uuid not null references public.birth_checklist_items (id) on delete cascade,
  storage_path text not null,
  position smallint not null check (position between 1 and 3),
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
-- RN-09: até 3 por item.
create unique index birth_item_attachments_posicao on public.birth_item_attachments (item_id, position) where apagado_em is null;

do $$
declare t text;
begin
  foreach t in array array['birth_plans', 'birth_checklist_items', 'birth_item_attachments']
  loop
    execute format('create trigger %I_familia before insert on public.%I for each row execute function public.preencher_familia()', t, t);
    execute format('create trigger %I_autor before insert on public.%I for each row execute function public.preencher_autor()', t, t);
    execute format('create trigger %I_conflito before update on public.%I for each row execute function public.manter_mais_recente()', t, t);
  end loop;
end $$;

alter table public.birth_plans enable row level security;
alter table public.birth_checklist_items enable row level security;
alter table public.birth_item_attachments enable row level security;

-- RN-10: o parceiro com `birth_plan` lê tudo, marca e adiciona itens; preferências e contatos, só ela.
create policy "plano: leem" on public.birth_plans for select using (public.tem_permissao(familia_id, 'birth_plan'));
create policy "plano: gestante insere" on public.birth_plans for insert with check (familia_id is null or public.eh_gestante(familia_id));
create policy "plano: gestante edita" on public.birth_plans for update using (public.eh_gestante(familia_id));
create policy "listas: leem" on public.birth_checklist_items for select using (public.tem_permissao(familia_id, 'birth_plan'));
create policy "listas: inserem" on public.birth_checklist_items for insert with check (familia_id is null or public.tem_permissao(familia_id, 'birth_plan'));
create policy "listas: editam" on public.birth_checklist_items for update using (public.tem_permissao(familia_id, 'birth_plan'));
create policy "anexos: leem" on public.birth_item_attachments for select using (public.tem_permissao(familia_id, 'birth_plan'));
create policy "anexos: gestante insere" on public.birth_item_attachments for insert with check (familia_id is null or public.eh_gestante(familia_id));
create policy "anexos: gestante edita" on public.birth_item_attachments for update using (public.eh_gestante(familia_id));

-- Storage: os anexos entram nas regras de visibilidade e gravação.
create or replace function public.arquivo_visivel(nome text)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.belly_photos where storage_path = nome)
      or exists (select 1 from public.diary_photos where storage_path = nome)
      or exists (select 1 from public.diary_entries where audio_path = nome)
      or exists (select 1 from public.document_pages where storage_path = nome)
      or exists (select 1 from public.birth_item_attachments where storage_path = nome)
$$;

create or replace function public.arquivo_gravavel(nome text)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.belly_photos where storage_path = nome and criado_por = auth.uid())
      or exists (select 1 from public.diary_photos f join public.diary_entries e on e.id = f.entry_id where f.storage_path = nome and e.criado_por = auth.uid())
      or exists (select 1 from public.diary_entries where audio_path = nome and criado_por = auth.uid())
      or exists (select 1 from public.document_pages where storage_path = nome and criado_por = auth.uid())
      or exists (select 1 from public.birth_item_attachments where storage_path = nome and criado_por = auth.uid())
$$;

-- RN-07: lembretes `birth_plan_nudge` entram no mesmo registro do que já saiu.
alter table public.reminders_sent drop constraint reminders_sent_categoria_check;
alter table public.reminders_sent add constraint reminders_sent_categoria_check check (categoria in ('med', 'exam', 'appt', 'belly', 'diary', 'partner', 'calendar', 'birth_plan'));
