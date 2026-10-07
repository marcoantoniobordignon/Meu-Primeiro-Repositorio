-- Funcionalidade 07 · Retrospectiva da gravidez: só a configuração é gravada; os slides são montados na hora com os
-- dados vivos (no aparelho, `@dominio/retrospectiva.ts`).
--
-- Decisões (também no CHANGELOG):
--   * "pregnancy" é a família (`familia_id`); os campos do nascimento ficam em `bebes` (peso e comprimento novos,
--     opcionais: RN-10). O registro de nascimento é o "Nasceu!" que já existia (decisão em aberto da spec: reutilizar).
--   * Só a gestante vê e edita a retrospectiva (critério: o parceiro só vê se ela compartilhar o vídeo).
--   * `chosen_entries` guarda {tipo_do_slide: {"entrada": id} | {"texto": "..."}}.

alter table public.bebes
  add column peso_g int check (peso_g between 500 and 7000),
  add column comprimento_cm numeric(4, 1) check (comprimento_cm between 20 and 65);

create table public.retrospectives (
  id uuid primary key,
  familia_id uuid references public.familias (id) on delete cascade,
  kind text not null check (kind in ('preview', 'final')),
  hidden_slides text[] not null default '{}',
  chosen_entries jsonb not null default '{}' check (jsonb_typeof(chosen_entries) = 'object'),
  last_exported_at timestamptz,
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagado_em timestamptz,
  unique (familia_id, kind),
  -- RN-05: os obrigatórios nunca ficam ocultos.
  check (not (hidden_slides && array['cover', 'duration', 'numbers', 'closing']))
);
create trigger retrospectives_familia before insert on public.retrospectives for each row execute function public.preencher_familia();
create trigger retrospectives_autor before insert on public.retrospectives for each row execute function public.preencher_autor();
create trigger retrospectives_conflito before update on public.retrospectives for each row execute function public.manter_mais_recente();

alter table public.retrospectives enable row level security;
create policy "retrospectiva: só a gestante" on public.retrospectives for all using (public.eh_gestante(familia_id)) with check (familia_id is null or public.eh_gestante(familia_id));

-- RN-09: push `retro_ready` no mesmo registro de envios.
alter table public.reminders_sent drop constraint reminders_sent_categoria_check;
alter table public.reminders_sent add constraint reminders_sent_categoria_check check (categoria in ('med', 'exam', 'appt', 'belly', 'diary', 'partner', 'calendar', 'birth_plan', 'faq', 'trimester', 'faith', 'letter', 'retro'));
