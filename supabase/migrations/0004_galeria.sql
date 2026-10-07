-- Ninho · funcionalidade 01 (specs/funcionalidades/01-galeria-exames.md): galeria de exames e ultrassons.
-- Mesma régua da 0003: nomes da spec, `familia_id`/`criado_por`/`criado_em`/`atualizado_em`/`apagado_em`.
-- Desvios do modelo da spec:
--   * a semana gestacional não é gravada (a spec manda calcular de `exam_date`);
--   * `profiles.consents` guarda `consents.ai_document_reading` (RN-05);
--   * `ai_document_reads` conta a cota de leituras por IA (RN-08); só a service role escreve;
--   * depois de excluído, o conteúdo do documento é apagado e os arquivos saem do Storage pelo job (`limpar_documentos_excluidos`, RN-03);
--   * PDFs exportados vivem em `exportacoes/{uid}/` e o job apaga depois de 24 h (`exportacoes_vencidas`, RN-09).

alter table public.profiles add column consents jsonb not null default '{}'::jsonb;

create table public.medical_documents (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  kind text not null check (kind in ('us_obstetric', 'us_nuchal', 'us_morpho', 'us_other', 'blood', 'urine', 'glucose', 'serology', 'culture_gbs', 'other')),
  title text check (char_length(title) <= 80),
  exam_date date not null,
  notes text check (char_length(notes) <= 1000),
  is_favorite boolean not null default false,
  shared_with_partner boolean not null default false,
  scheduled_exam_id uuid references public.user_exams (id) on delete set null,
  ai_status text not null default 'none' check (ai_status in ('none', 'pending', 'done', 'failed')),
  ai_summary jsonb,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  -- RN-01: data não pode ser futura (1 dia de folga para fusos à frente do servidor).
  check (exam_date <= current_date + 1),
  -- RN-12: favoritar só ultrassom.
  check (not is_favorite or kind like 'us\_%')
);
create index medical_documents_linha_do_tempo on public.medical_documents (familia_id, exam_date desc) where apagado_em is null;

-- Limites técnicos: 20 páginas por documento, 15 MB por arquivo depois da compressão.
create table public.document_pages (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  document_id uuid not null references public.medical_documents (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  storage_path text not null,
  mime text not null,
  bytes int not null check (bytes between 1 and 15728640),
  width int,
  height int,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create index document_pages_documento on public.document_pages (document_id, position) where apagado_em is null;

-- Exames (spec 03): o resultado anexado.
alter table public.user_exams add constraint user_exams_document_id_fkey foreign key (document_id) references public.medical_documents (id) on delete set null;

-- RN-08: cota de 20 leituras por mês; só leituras bem-sucedidas contam (RN-07).
create table public.ai_document_reads (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias (id) on delete cascade,
  document_id uuid references public.medical_documents (id) on delete set null,
  ok boolean not null,
  criado_em timestamptz not null default now()
);
create index ai_document_reads_mes on public.ai_document_reads (familia_id, criado_em desc);

do $$
declare t text;
begin
  foreach t in array array['medical_documents', 'document_pages']
  loop
    execute format('create trigger %I_familia before insert on public.%I for each row execute function public.preencher_familia()', t, t);
    execute format('create trigger %I_autor before insert on public.%I for each row execute function public.preencher_autor()', t, t);
    execute format('create trigger %I_conflito before update on public.%I for each row execute function public.manter_mais_recente()', t, t);
  end loop;
end $$;

alter table public.medical_documents enable row level security;
alter table public.document_pages enable row level security;
alter table public.ai_document_reads enable row level security;

-- Dado de saúde da gestante. RN-10: o parceiro só vê o que ela marcou como compartilhado.
create policy "galeria: leem" on public.medical_documents for select using (
  public.eh_membro(familia_id) and (public.eh_gestante(familia_id) or criado_por = auth.uid() or (public.papel_do_usuario() = 'parceiro' and shared_with_partner))
);
create policy "galeria: gestante insere" on public.medical_documents for insert with check (familia_id is null or public.eh_gestante(familia_id));
create policy "galeria: gestante edita" on public.medical_documents for update using (public.eh_gestante(familia_id));
create policy "páginas: quem vê o documento" on public.document_pages for select using (exists (select 1 from public.medical_documents d where d.id = document_id));
create policy "páginas: gestante insere" on public.document_pages for insert with check (familia_id is null or public.eh_gestante(familia_id));
create policy "páginas: gestante edita" on public.document_pages for update using (public.eh_gestante(familia_id));
-- ai_document_reads: sem policy, só a service role (Edge Function `ler-laudo`).

-- Storage: as páginas entram nas regras de visibilidade e gravação da 0003.
create or replace function public.arquivo_visivel(nome text)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.belly_photos where storage_path = nome)
      or exists (select 1 from public.diary_photos where storage_path = nome)
      or exists (select 1 from public.diary_entries where audio_path = nome)
      or exists (select 1 from public.document_pages where storage_path = nome)
$$;

create or replace function public.arquivo_gravavel(nome text)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.belly_photos where storage_path = nome and criado_por = auth.uid())
      or exists (select 1 from public.diary_photos f join public.diary_entries e on e.id = f.entry_id where f.storage_path = nome and e.criado_por = auth.uid())
      or exists (select 1 from public.diary_entries where audio_path = nome and criado_por = auth.uid())
      or exists (select 1 from public.document_pages where storage_path = nome and criado_por = auth.uid())
$$;

-- RN-09: o PDF exportado mora na pasta da própria pessoa e vale 24 h (o job apaga depois).
create policy "exportações: a própria pasta (subir)" on storage.objects for insert to authenticated with check (
  bucket_id = 'ninho-privado' and (storage.foldername(name))[1] = 'exportacoes' and (storage.foldername(name))[2] = auth.uid()::text
);
create policy "exportações: a própria pasta (ler)" on storage.objects for select to authenticated using (
  bucket_id = 'ninho-privado' and (storage.foldername(name))[1] = 'exportacoes' and (storage.foldername(name))[2] = auth.uid()::text
);

-- RN-03: excluído é definitivo. O job chama isto: esvazia o conteúdo dos documentos excluídos (fica só o id,
-- para a sincronização não o ressuscitar) e devolve os arquivos a remover do Storage. As linhas das páginas
-- só saem depois que o Storage confirma (o job apaga), para nenhum arquivo ficar órfão.
create or replace function public.limpar_documentos_excluidos()
returns table (caminho text) language plpgsql security definer set search_path = public as $$
begin
  update public.medical_documents
     set title = null, notes = null, ai_summary = null, ai_status = 'none', atualizado_em = now()
   where apagado_em is not null and (title is not null or notes is not null or ai_summary is not null or ai_status <> 'none');
  return query
    select p.storage_path from public.document_pages p
      join public.medical_documents d on d.id = p.document_id
     where p.apagado_em is not null or d.apagado_em is not null;
end $$;
revoke execute on function public.limpar_documentos_excluidos() from public, anon, authenticated;

-- RN-09: PDFs exportados com mais de 24 h (o job apaga pelo Storage, que remove o arquivo de fato).
create or replace function public.exportacoes_vencidas()
returns table (caminho text) language sql stable security definer set search_path = public, storage as $$
  select o.name from storage.objects o
   where o.bucket_id = 'ninho-privado' and o.name like 'exportacoes/%' and o.created_at < now() - interval '24 hours'
$$;
revoke execute on function public.exportacoes_vencidas() from public, anon, authenticated;
