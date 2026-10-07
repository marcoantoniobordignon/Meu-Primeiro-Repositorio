-- Ninho · funcionalidades 02–06 (specs/funcionalidades): medicamentos, exames, consultas,
-- foto da barriga e diário, com os lembretes, o Storage privado e as permissões do parceiro.
--
-- Nomes de tabela, coluna e valor como nas specs. As colunas de infraestrutura seguem a régua
-- do projeto (0001): `pregnancy_id` → `familia_id`; `created_by`/`author_id` → `criado_por`;
-- `created_at`/`updated_at` → `criado_em`/`atualizado_em`; `apagado_em` é o soft delete que a
-- sincronização usa. Desvios do modelo das specs, todos para a RLS ou a sincronização funcionarem:
--   * `appointments.notes_after` mora em `appointment_measures` (tabela só da gestante: o parceiro
--     nunca vê medidas nem orientações, RN-10 da spec 04); `appointment_measures` ganha `id` (= appointment_id);
--   * `appointments.followup_dismissed` guarda o "Como foi?" respondido/dispensado (RN-07, uma vez cada);
--   * `medications.reminders_on` (RN-15) e `medication_doses.snooze_count/snoozed_until` (RN-05);
--   * `user_exams.window_start_week/window_end_week` (janela opcional do exame personalizado, RN-09);
--   * `diary_entries.photo_count` deixa o banco checar "texto, áudio ou foto" (RN-01) sem depender da ordem de envio;
--   * `diary_milestone_states` guarda "Pular" e "Mais tarde" (RN-03) por autora e marco;
--   * `user_exams.document_id` ganha a FK para `medical_documents` na 0004 (galeria, spec 01).
-- A antiga `consultas` (spec 05) vira `appointments` aqui; o app faz a mesma conversão no aparelho.

-- ---------------------------------------------------------------------------
-- Perfil e permissões do parceiro
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column tz text not null default 'America/Sao_Paulo',
  add column prefs jsonb not null default '{}'::jsonb;

alter table public.membros_familia add column permissoes jsonb not null default '{}'::jsonb;

-- Padrões: agenda ligada; fotos da barriga desligadas (spec 05 RN-11).
create or replace function public.tem_permissao(f uuid, chave text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when m.papel = 'mae' then true
      when m.papel = 'parceiro' then coalesce((m.permissoes ->> chave)::boolean, chave = 'agenda')
      else false
    end
    from public.membros_familia m where m.familia_id = f and m.profile_id = auth.uid()
  ), false)
$$;

create or replace function public.eh_gestante(f uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros_familia where familia_id = f and profile_id = auth.uid() and papel = 'mae')
$$;

create or replace function public.definir_permissoes_parceiro(p_profile_id uuid, p_permissoes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare f uuid := public.familia_do_usuario();
begin
  if public.papel_do_usuario() <> 'mae' then raise exception 'só a gestante muda as permissões'; end if;
  update public.membros_familia
     set permissoes = jsonb_build_object(
           'agenda', coalesce((p_permissoes ->> 'agenda')::boolean, true),
           'belly_photos', coalesce((p_permissoes ->> 'belly_photos')::boolean, false))
   where familia_id = f and profile_id = p_profile_id and papel = 'parceiro';
  if not found then raise exception 'parceiro não encontrado'; end if;
end $$;

drop function public.meus_membros();
create function public.meus_membros()
returns table (profile_id uuid, nome text, papel text, convidado_por uuid, ultimo_acesso_em timestamptz, permissoes jsonb)
language sql stable security definer set search_path = public as $$
  select m.profile_id, p.nome, m.papel, m.convidado_por, m.ultimo_acesso_em, m.permissoes
  from public.membros_familia m join public.profiles p on p.id = m.profile_id
  where m.familia_id = public.familia_do_usuario()
$$;

-- ---------------------------------------------------------------------------
-- Funcionalidade 04 · Cronograma de consultas
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  starts_at timestamptz not null,
  kind text not null default 'prenatal' check (kind in ('prenatal', 'ultrasound', 'other')),
  provider_name text check (char_length(provider_name) <= 80),
  provider_role text check (provider_role in ('obstetrician', 'midwife', 'nurse', 'nutritionist', 'dentist', 'other')),
  location text check (char_length(location) <= 120),
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  followup_dismissed boolean not null default false,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create index appointments_familia_inicio on public.appointments (familia_id, starts_at) where apagado_em is null;

create table public.appointment_questions (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  -- RN-02: nulo = "para a próxima consulta".
  appointment_id uuid references public.appointments (id) on delete set null,
  text text not null check (char_length(btrim(text)) between 3 and 280),
  was_asked boolean not null default false,
  answer text check (char_length(answer) <= 500),
  position int not null default 0,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);

-- RN-04: faixas do modelo; fora delas o banco recusa (o app mostra "Confira o valor").
create table public.appointment_measures (
  id uuid primary key references public.appointments (id) on delete cascade,
  appointment_id uuid not null unique references public.appointments (id) on delete cascade check (appointment_id = id),
  familia_id uuid references public.familias (id) on delete cascade,
  weight_kg numeric(5, 2) check (weight_kg between 30 and 250),
  bp_sys smallint check (bp_sys between 60 and 260),
  bp_dia smallint check (bp_dia between 30 and 160),
  fundal_height_cm numeric(4, 1) check (fundal_height_cm between 0 and 60),
  fetal_heart_rate smallint check (fetal_heart_rate between 60 and 220),
  notes_after text check (char_length(notes_after) <= 1000),
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);

-- A antiga `consultas` (spec 05) vira `appointments` (+ notas em `appointment_measures`).
insert into public.appointments (id, familia_id, starts_at, kind, provider_name, provider_role, location, status, criado_por, criado_em, atualizado_em, apagado_em)
select id, familia_id, data,
       case tipo when 'pre_natal' then 'prenatal' when 'ultrassom' then 'ultrasound' else 'other' end,
       left(profissional, 80), null, left(local, 120),
       case when realizada then 'done' else 'scheduled' end,
       criado_por, criado_em, atualizado_em, apagado_em
from public.consultas;
insert into public.appointment_measures (id, appointment_id, familia_id, notes_after, criado_por, criado_em, atualizado_em, apagado_em)
select id, id, familia_id, left(notas, 1000), criado_por, criado_em, atualizado_em, apagado_em
from public.consultas where notas is not null and btrim(notas) <> '';
drop table public.consultas;

-- ---------------------------------------------------------------------------
-- Funcionalidade 02 · Medicamentos
-- ---------------------------------------------------------------------------
create table public.medications (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  dose text check (char_length(dose) <= 40),
  instructions text check (char_length(instructions) <= 120),
  schedule_type text not null check (schedule_type in ('fixed_times', 'interval', 'weekdays', 'as_needed')),
  times time[] check (times is null or cardinality(times) between 1 and 4),
  interval_hours smallint check (interval_hours between 4 and 24),
  interval_anchor time,
  weekdays smallint[] check (weekdays is null or weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  starts_on date not null default current_date,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  is_active boolean not null default true,
  reminders_on boolean not null default true,
  color_key text not null,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  check (schedule_type <> 'fixed_times' or times is not null),
  check (schedule_type <> 'weekdays' or (times is not null and cardinality(weekdays) >= 1)),
  check (schedule_type <> 'interval' or (interval_hours is not null and interval_anchor is not null))
);

create table public.medication_doses (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete cascade,
  scheduled_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'taken', 'skipped', 'missed')),
  taken_at timestamptz,
  source text check (source in ('push', 'app', 'voice', 'backfill')),
  snooze_count smallint not null default 0 check (snooze_count between 0 and 2),
  snoozed_until timestamptz,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create unique index medication_doses_unica on public.medication_doses (medication_id, scheduled_at) where scheduled_at is not null and apagado_em is null;
create index medication_doses_pendentes on public.medication_doses (scheduled_at) where status = 'pending' and apagado_em is null;

-- ---------------------------------------------------------------------------
-- Funcionalidade 03 · Exames
-- ---------------------------------------------------------------------------
create table public.exam_catalog (
  code text primary key,
  name text not null,
  short_desc text not null check (char_length(short_desc) <= 140),
  window_start_day smallint not null,
  window_end_day smallint not null check (window_end_day >= window_start_day),
  trimester smallint not null check (trimester between 1 and 3),
  doc_kind text not null,
  is_default_on boolean not null default false
);

-- Sementes (iguais a supabase/functions/_shared/dominio/exames.ts; o teste confere). Revisão clínica pendente.
insert into public.exam_catalog (code, name, short_desc, window_start_day, window_end_day, trimester, doc_kind, is_default_on) values
  ('us_dating', 'Ultrassom inicial', 'Confirma há quanto tempo você está grávida e quantos bebês são. Pode ser pela barriga ou por via vaginal.', 42, 76, 1, 'imaging', true),
  ('blood_1', 'Exames de sangue do 1º trimestre', 'Tipo de sangue, anemia, açúcar no sangue e infecções como sífilis, HIV e hepatites, para cuidar cedo.', 42, 97, 1, 'lab', true),
  ('urine_1', 'Urina e urocultura', 'Procura infecção urinária, que na gravidez pode não dar nenhum sintoma.', 42, 97, 1, 'lab', true),
  ('nuchal', 'Ultrassom de translucência nucal', 'Mede uma área na nuca do bebê. Ajuda a estimar a chance de algumas alterações genéticas.', 77, 97, 1, 'imaging', true),
  ('morpho', 'Ultrassom morfológico', 'Ultrassom detalhado que olha a formação de cada parte do corpo do bebê.', 140, 174, 2, 'imaging', true),
  ('ogtt', 'Curva glicêmica (TOTG)', 'Você toma um líquido doce e colhe sangue algumas vezes. Serve para ver se há diabetes da gestação.', 168, 202, 2, 'lab', true),
  ('blood_3', 'Repetição de exames de sangue', 'Repete parte dos exames do começo para ver como você está na reta final.', 196, 230, 3, 'lab', true),
  ('urine_3', 'Urina e urocultura (repetição)', 'Repete a busca por infecção urinária, que pode aparecer em qualquer fase.', 196, 244, 3, 'lab', true),
  ('gbs', 'Cultura para estreptococo B', 'Coleta com cotonete para ver se há uma bactéria que pode passar para o bebê no parto.', 245, 265, 3, 'lab', true),
  ('coombs', 'Coombs indireto', 'Para quem tem sangue Rh negativo: vê se o corpo está criando anticorpos contra o sangue do bebê.', 196, 209, 3, 'lab', false),
  ('fetal_echo', 'Ecocardiograma fetal', 'Ultrassom focado no coração do bebê, quando o médico vê motivo para olhar mais de perto.', 168, 202, 2, 'imaging', false),
  ('us_growth', 'Ultrassom de crescimento', 'Confere o tamanho, o peso estimado e o líquido ao redor do bebê.', 224, 258, 3, 'imaging', false),
  ('ctg', 'Cardiotocografia', 'Registra os batimentos do bebê e as contrações por uns 20 a 40 minutos.', 252, 286, 3, 'other', false);

create table public.user_exams (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  catalog_code text references public.exam_catalog (code),
  custom_name text check (custom_name is null or char_length(btrim(custom_name)) between 3 and 60),
  status text not null default 'to_schedule' check (status in ('to_schedule', 'scheduled', 'done', 'dismissed')),
  window_start_date date,
  window_end_date date,
  past_window boolean not null default false,
  window_start_week smallint check (window_start_week between 4 and 42),
  window_end_week smallint check (window_end_week between 4 and 42),
  scheduled_at timestamptz,
  scheduled_all_day boolean not null default false,
  location text check (char_length(location) <= 80),
  notes text check (char_length(notes) <= 300),
  done_on date,
  document_id uuid, -- FK na 0004_galeria.sql
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  -- RN-09: nome obrigatório se não é do catálogo.
  check (catalog_code is not null or custom_name is not null),
  check (status <> 'scheduled' or scheduled_at is not null)
);
create unique index user_exams_um_por_codigo on public.user_exams (familia_id, catalog_code) where catalog_code is not null and apagado_em is null;

-- ---------------------------------------------------------------------------
-- Funcionalidade 05 · Foto semanal da barriga
-- ---------------------------------------------------------------------------
create table public.belly_photos (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  gest_week smallint not null check (gest_week between 4 and 42),
  taken_on date not null,
  storage_path text not null,
  width int,
  height int,
  caption text check (char_length(caption) <= 100),
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create unique index belly_photos_uma_por_semana on public.belly_photos (familia_id, gest_week) where apagado_em is null;

-- RN-12: a semana da foto é gravada e imutável (mudar a DUM não mexe nela).
create or replace function public.semana_da_foto_imutavel()
returns trigger language plpgsql as $$
begin
  if new.gest_week <> old.gest_week then
    raise exception 'gest_week é imutável';
  end if;
  return new;
end $$;
create trigger belly_photos_semana_imutavel before update on public.belly_photos for each row execute function public.semana_da_foto_imutavel();

-- ---------------------------------------------------------------------------
-- Funcionalidade 06 · Diário
-- ---------------------------------------------------------------------------
create table public.milestone_catalog (
  code text primary key,
  title text not null,
  prompt_text text not null,
  prompt_text_faith text,
  faith_only boolean not null default false,
  window_start_week smallint,
  window_end_week smallint,
  push_on_open boolean not null default false,
  position int not null
);

-- Sementes (iguais a supabase/functions/_shared/dominio/diario.ts; o teste confere). Texto final: revisão editorial.
insert into public.milestone_catalog (code, title, prompt_text, prompt_text_faith, faith_only, window_start_week, window_end_week, push_on_open, position) values
  ('discovery', 'Quando descobri', 'Como você descobriu a gravidez? Onde estava, o que sentiu, para quem contou primeiro?', 'Como você descobriu a gravidez? O que sentiu e o que agradeceu naquele dia?', false, null, null, true, 1),
  ('told_partner', 'Contei para quem amo', 'Como foi contar para quem você ama? Qual foi a reação?', null, false, 5, 14, false, 2),
  ('first_ultrasound', 'Primeiro ultrassom', 'Como foi ver o bebê pela primeira vez no ultrassom?', null, false, 6, 12, false, 3),
  ('heartbeat', 'Ouvi o coração', 'O que passou pela sua cabeça quando ouviu o coração do bebê?', 'O que passou pela sua cabeça, e pelo seu coração, quando ouviu o coração do bebê?', false, 6, 12, false, 4),
  ('belly_shows', 'A barriga apareceu', 'Quando você percebeu a barriga aparecendo? Alguém comentou?', null, false, 12, 20, false, 5),
  ('sex_known', 'Descobri o sexo', 'Como foi descobrir o sexo do bebê? Era o que você imaginava?', null, false, 14, 22, true, 6),
  ('first_kick', 'Primeiro chute', 'Como foi sentir o primeiro chute? Onde você estava?', null, false, 16, 24, true, 7),
  ('name_chosen', 'Escolhemos o nome', 'Como vocês escolheram o nome? Quais outras opções quase ganharam?', null, false, 16, 36, false, 8),
  ('baby_shower', 'Chá de bebê', 'Como foi o chá de bebê? Quem estava lá e o que ficou na memória?', null, false, 28, 36, false, 9),
  ('bag_ready', 'A mala ficou pronta', 'O que entrou na mala? O que você fez questão de levar?', null, false, 34, 38, false, 10),
  ('feelings_before', 'Como estou me sentindo', 'Como você está se sentindo agora, tão perto de conhecer o bebê?', 'Como você está se sentindo agora, tão perto de conhecer o bebê? O que você pede para esse momento?', false, 36, 41, false, 11),
  ('first_prayer', 'Primeira oração pelo bebê', 'Escreva a sua primeira oração pelo bebê.', 'Escreva a sua primeira oração pelo bebê. Pode ser curtinha.', true, 5, 20, false, 12);

create table public.diary_entries (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  kind text not null check (kind in ('free', 'milestone')),
  milestone_code text references public.milestone_catalog (code),
  body text check (char_length(body) <= 5000),
  entry_date date not null default current_date,
  audio_path text,
  audio_seconds smallint check (audio_seconds between 0 and 180),
  shared_with_partner boolean not null default false,
  photo_count smallint not null default 0 check (photo_count between 0 and 3),
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  check ((kind = 'milestone') = (milestone_code is not null)),
  -- RN-01: texto, áudio ou ao menos uma foto.
  check (nullif(btrim(body), '') is not null or audio_path is not null or photo_count > 0),
  -- RN-07: data não pode ser futura (1 dia de folga para fusos à frente do servidor).
  check (entry_date <= current_date + 1)
);
-- RN-02: um marco por autora.
create unique index diary_entries_um_marco on public.diary_entries (familia_id, criado_por, milestone_code) where milestone_code is not null and apagado_em is null;
create index diary_entries_linha_do_tempo on public.diary_entries (familia_id, entry_date desc) where apagado_em is null;

create table public.diary_photos (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  entry_id uuid not null references public.diary_entries (id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  storage_path text not null,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);

create table public.diary_milestone_states (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  milestone_code text not null references public.milestone_catalog (code),
  skipped_at timestamptz,
  snoozed_until timestamptz,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create unique index diary_milestone_states_unico on public.diary_milestone_states (familia_id, criado_por, milestone_code) where apagado_em is null;

-- ---------------------------------------------------------------------------
-- Lembretes: inscrições de push e o registro do que já saiu (só o servidor escreve)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  endpoint text primary key,
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.reminders_sent (
  familia_id uuid not null references public.familias (id) on delete cascade,
  chave text not null,
  categoria text not null check (categoria in ('med', 'exam', 'appt', 'belly', 'diary')),
  tipo text not null,
  ref text not null,
  essencial boolean not null default false,
  enviado_em timestamptz not null default now(),
  primary key (familia_id, chave)
);
create index reminders_sent_recentes on public.reminders_sent (familia_id, enviado_em desc);

-- ---------------------------------------------------------------------------
-- Triggers por tabela (mesma régua da 0001)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['appointments', 'appointment_questions', 'appointment_measures', 'medications', 'medication_doses', 'user_exams', 'belly_photos', 'diary_entries', 'diary_photos', 'diary_milestone_states']
  loop
    execute format('create trigger %I_familia before insert on public.%I for each row execute function public.preencher_familia()', t, t);
    execute format('create trigger %I_autor before insert on public.%I for each row execute function public.preencher_autor()', t, t);
    execute format('create trigger %I_conflito before update on public.%I for each row execute function public.manter_mais_recente()', t, t);
  end loop;
end $$;
create trigger push_subscriptions_conflito before update on public.push_subscriptions for each row execute function public.manter_mais_recente();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.appointments enable row level security;
alter table public.appointment_questions enable row level security;
alter table public.appointment_measures enable row level security;
alter table public.medications enable row level security;
alter table public.medication_doses enable row level security;
alter table public.exam_catalog enable row level security;
alter table public.user_exams enable row level security;
alter table public.belly_photos enable row level security;
alter table public.milestone_catalog enable row level security;
alter table public.diary_entries enable row level security;
alter table public.diary_photos enable row level security;
alter table public.diary_milestone_states enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminders_sent enable row level security;

create policy "catálogo de exames: todos leem" on public.exam_catalog for select using (true);
create policy "catálogo de marcos: todos leem" on public.milestone_catalog for select using (true);

-- Spec 04 RN-10: parceiro com a permissão `agenda` vê data, local, profissional e pauta e anota perguntas;
-- só a gestante cria, edita e conclui consultas. Avó e cuidador não veem a agenda (dado de saúde).
create policy "appointments: agenda lê" on public.appointments for select using (public.tem_permissao(familia_id, 'agenda'));
create policy "appointments: gestante insere" on public.appointments for insert with check (familia_id is null or public.eh_gestante(familia_id));
create policy "appointments: gestante edita" on public.appointments for update using (public.eh_gestante(familia_id));
create policy "perguntas: agenda lê" on public.appointment_questions for select using (public.tem_permissao(familia_id, 'agenda'));
create policy "perguntas: agenda anota" on public.appointment_questions for insert with check (familia_id is null or public.tem_permissao(familia_id, 'agenda'));
create policy "perguntas: gestante ou autor edita" on public.appointment_questions for update using (public.eh_gestante(familia_id) or (criado_por = auth.uid() and public.tem_permissao(familia_id, 'agenda')));
-- RN-10: medidas e orientações, nunca o parceiro.
create policy "medidas: só a gestante" on public.appointment_measures for all using (public.eh_gestante(familia_id)) with check (familia_id is null or public.eh_gestante(familia_id));

-- Spec 02 RN-14: medicamentos só da gestante.
create policy "medicamentos: só a gestante" on public.medications for all using (public.eh_gestante(familia_id)) with check (familia_id is null or public.eh_gestante(familia_id));
create policy "doses: só a gestante" on public.medication_doses for all using (public.eh_gestante(familia_id)) with check (familia_id is null or public.eh_gestante(familia_id));

-- Spec 03: dado de saúde, mesma régua dos sintomas (gestante e parceiro).
create policy "exames: leem" on public.user_exams for select using (public.eh_membro(familia_id) and public.ve_dados_da_mae());
create policy "exames: inserem" on public.user_exams for insert with check (familia_id is null or (public.eh_membro(familia_id) and public.ve_dados_da_mae()));
create policy "exames: editam" on public.user_exams for update using (public.eh_membro(familia_id) and public.ve_dados_da_mae());

-- Spec 05 RN-11: parceiro vê a grade só com `belly_photos`; só a gestante tira fotos.
create policy "barriga: leem" on public.belly_photos for select using (public.tem_permissao(familia_id, 'belly_photos'));
create policy "barriga: gestante insere" on public.belly_photos for insert with check (familia_id is null or public.eh_gestante(familia_id));
create policy "barriga: gestante edita" on public.belly_photos for update using (public.eh_gestante(familia_id));

-- Spec 06 RN-09: o parceiro só vê as compartilhadas; as dele aparecem sempre para a gestante; só o autor edita.
create policy "diário: leem" on public.diary_entries for select using (
  public.eh_membro(familia_id) and (
    criado_por = auth.uid()
    or public.eh_gestante(familia_id)
    or (public.papel_do_usuario() = 'parceiro' and shared_with_partner)
  )
);
create policy "diário: escrevem" on public.diary_entries for insert with check (
  (familia_id is null or public.eh_membro(familia_id)) and public.papel_do_usuario() in ('mae', 'parceiro') and (criado_por is null or criado_por = auth.uid())
);
create policy "diário: só o autor edita" on public.diary_entries for update using (criado_por = auth.uid());
create policy "fotos do diário: quem vê a entrada" on public.diary_photos for select using (exists (select 1 from public.diary_entries e where e.id = entry_id));
create policy "fotos do diário: autor da entrada" on public.diary_photos for insert with check (exists (select 1 from public.diary_entries e where e.id = entry_id and e.criado_por = auth.uid()));
create policy "fotos do diário: autor edita" on public.diary_photos for update using (exists (select 1 from public.diary_entries e where e.id = entry_id and e.criado_por = auth.uid()));
create policy "estados dos marcos: da própria autora" on public.diary_milestone_states for all using (criado_por = auth.uid()) with check ((familia_id is null or public.eh_membro(familia_id)) and (criado_por is null or criado_por = auth.uid()));

create policy "push: a própria inscrição" on public.push_subscriptions for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
-- reminders_sent: sem policy, só a service role (job de lembretes) lê e escreve.

grant execute on function public.definir_permissoes_parceiro(uuid, jsonb), public.meus_membros() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage privado: fotos e áudios (as páginas da galeria entram na 0004) (nenhum arquivo sai do Supabase do projeto)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('ninho-privado', 'ninho-privado', false) on conflict (id) do nothing;

-- Vê o arquivo quem vê a linha que o referencia (a RLS de cada tabela decide: parceiro e diário, RN-09; barriga, RN-11).
create or replace function public.arquivo_visivel(nome text)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.belly_photos where storage_path = nome)
      or exists (select 1 from public.diary_photos where storage_path = nome)
      or exists (select 1 from public.diary_entries where audio_path = nome)
$$;

-- Sobe o arquivo quem é autor da linha (a linha sincroniza antes; o app respeita essa ordem).
create or replace function public.arquivo_gravavel(nome text)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.belly_photos where storage_path = nome and criado_por = auth.uid())
      or exists (select 1 from public.diary_photos f join public.diary_entries e on e.id = f.entry_id where f.storage_path = nome and e.criado_por = auth.uid())
      or exists (select 1 from public.diary_entries where audio_path = nome and criado_por = auth.uid())
$$;

create policy "ninho-privado: ler" on storage.objects for select to authenticated using (bucket_id = 'ninho-privado' and public.arquivo_visivel(name));
create policy "ninho-privado: subir" on storage.objects for insert to authenticated with check (bucket_id = 'ninho-privado' and public.arquivo_gravavel(name));
create policy "ninho-privado: substituir" on storage.objects for update to authenticated using (bucket_id = 'ninho-privado' and owner_id = auth.uid()::text);
-- Apagar (RN-08 do diário, RN-01/10 da barriga): o dono do objeto, mesmo depois que a linha deixou de apontar para ele.
create policy "ninho-privado: apagar" on storage.objects for delete to authenticated using (bucket_id = 'ninho-privado' and owner_id = auth.uid()::text);
