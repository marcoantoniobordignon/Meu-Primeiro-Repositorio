"use client";

import { useEffect } from "react";

import { novoId } from "@/lib/dados/colecao";
import { userExams, type UserExam } from "@/lib/dados/colecoes";
import { aoSincronizar } from "@/lib/offline/sync";
import { criarDoCatalogo, duplicadosDoCatalogo, gerarExamesPadrao, janelaDoExame, recalcularJanelas } from "@dominio/exames.ts";
import { dataNoFuso, type DataISO } from "@dominio/tempo.ts";

import { instanteDaMarcacao, type Marcacao } from "./regras";

export interface ContextoExames {
  dpp: DataISO;
  /** Data em que a gestação foi criada (fim do onboarding). */
  criadaEm: DataISO;
  semente: string;
  tz: string;
}

/**
 * Mantém a lista "Meus exames" (no app; idempotente, sem escrita à toa):
 * - RN-01: gera os padrões uma vez (a lista recém-criada nunca está vazia);
 * - RN-02: mudou a DUM, recalcula as janelas dos não concluídos;
 * - dois aparelhos que geraram o mesmo exame do catálogo ficam com um só.
 */
export function manterExames(ctx: ContextoExames, agora = new Date()): void {
  const hoje = dataNoFuso(agora, ctx.tz);
  const todos = userExams.listarTodos();
  // Qualquer exame do catálogo, mesmo apagado, prova que a lista já foi gerada (do catálogo só se dispensa).
  if (!todos.some((e) => e.catalog_code)) {
    for (const e of gerarExamesPadrao(ctx.dpp, ctx.criadaEm, ctx.semente)) userExams.salvar({ ...e, location: null, notes: null, document_id: null });
  }
  for (const id of duplicadosDoCatalogo(userExams.listar())) userExams.apagar(id);
  for (const e of recalcularJanelas(userExams.listar(), ctx.dpp, hoje)) userExams.salvar(e);
}

export function useManutencaoExames(ctx: ContextoExames | null): void {
  const chave = ctx ? `${ctx.dpp}|${ctx.criadaEm}|${ctx.semente}|${ctx.tz}` : "";
  useEffect(() => {
    if (!chave) return;
    const [dpp, criadaEm, semente, tz] = chave.split("|") as [string, string, string, string];
    const rodar = () => manterExames({ dpp, criadaEm, semente, tz });
    rodar();
    return aoSincronizar(rodar);
  }, [chave]);
}

/** RN-06/07: marcar (ou remarcar). */
export function marcarExame(e: UserExam, m: Marcacao, tz: string, extra: { location: string | null; notes: string | null }): UserExam {
  return userExams.salvar({ ...e, status: "scheduled", ...instanteDaMarcacao(m, tz), location: extra.location, notes: extra.notes });
}

/** RN-08: concluir (com ou sem documento). "Já fiz" em exame anterior aceita sem data (decisão tomada). */
export function concluirExame(e: UserExam, hoje: DataISO | null, documentId: string | null = null): UserExam {
  return userExams.salvar({ ...e, status: "done", done_on: hoje, document_id: documentId ?? e.document_id });
}

/** RN-10: dispensar é reversível. */
export function dispensarExame(e: UserExam): UserExam {
  return userExams.salvar({ ...e, status: "dismissed" });
}

/** Restaurar volta para "marcado" se ainda havia data futura; senão, "a marcar". */
export function restaurarExame(e: UserExam, agora = new Date()): UserExam {
  const futuro = e.scheduled_at && new Date(e.scheduled_at).getTime() > agora.getTime();
  return userExams.salvar({ ...e, status: futuro ? "scheduled" : "to_schedule" });
}

/** "Remarquei" no lembrete do dia seguinte: volta para "a marcar" até ela escolher a nova data. */
export function desmarcarExame(e: UserExam): UserExam {
  return userExams.salvar({ ...e, status: "to_schedule", scheduled_at: null, scheduled_all_day: false });
}

/** "Outros exames comuns". */
export function adicionarDoCatalogo(code: string, ctx: ContextoExames, agora = new Date()): UserExam {
  const base = criarDoCatalogo(code, ctx.dpp, dataNoFuso(agora, ctx.tz), ctx.semente);
  const existente = userExams.obter(base.id);
  // Mesmo id (determinístico): se foi apagado antes, volta à vida limpo.
  return userExams.salvar({ ...existente, ...base, location: null, notes: null, document_id: null, apagado_em: null });
}

/** RN-09: "Criar o meu" — nome obrigatório, janela opcional em semanas. */
export function criarPersonalizado(nome: string, semanas: { inicio: number | null; fim: number | null }, ctx: ContextoExames, agora = new Date()): UserExam {
  const base = { catalog_code: null, window_start_week: semanas.inicio, window_end_week: semanas.fim };
  const j = janelaDoExame(base, ctx.dpp);
  return userExams.salvar({
    id: novoId(),
    ...base,
    custom_name: nome.trim().slice(0, 60),
    status: "to_schedule",
    window_start_date: j.inicio,
    window_end_date: j.fim,
    past_window: Boolean(j.fim && j.fim < dataNoFuso(agora, ctx.tz)),
    scheduled_at: null,
    scheduled_all_day: false,
    location: null,
    notes: null,
    done_on: null,
    document_id: null,
  });
}

/** Personalizado pode ser apagado de vez; do catálogo, só dispensado. */
export function apagarPersonalizado(e: UserExam): void {
  if (!e.catalog_code) userExams.apagar(e.id);
}
