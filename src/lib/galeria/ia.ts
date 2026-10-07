"use client";

import { medicalDocuments } from "@/lib/dados/colecoes";
import { atualizarPerfil, type Perfil } from "@/lib/perfil";
import { sincronizar } from "@/lib/offline/sync";
import { supabase } from "@/lib/supabase/client";
import { validarResumo, type ResumoLaudo } from "@dominio/galeria.ts";

/** RN-05: o consentimento é da pessoa, guardado em `profiles.consents`, e vale até ela desligar. */
export function temConsentimento(perfil: Perfil | null | undefined): boolean {
  return Boolean(perfil?.consents?.ai_document_reading?.given_at);
}

export function darConsentimento(perfil: Perfil): Perfil | null {
  return atualizarPerfil({ consents: { ...perfil.consents, ai_document_reading: { given_at: new Date().toISOString() } } });
}

export function retirarConsentimento(perfil: Perfil): void {
  atualizarPerfil({ consents: { ...perfil.consents, ai_document_reading: null } });
}

export type ResultadoLeitura =
  | { tipo: "ok"; resumo: ResumoLaudo; restantes: number }
  | { tipo: "falhou" }
  | { tipo: "sem_cota"; renova: string }
  | { tipo: "sem_consentimento" }
  | { tipo: "sem_rede" }
  | { tipo: "aguardando" }
  | { tipo: "premium" };

interface Resposta {
  status: "done" | "failed" | "sem_cota" | "sem_consentimento" | "premium" | "aguardando";
  ai_summary?: unknown;
  restantes?: number;
  renova?: string;
  atualizado_em?: string;
}

/**
 * RN-05..08: só quando ela toca em "Ler laudo"; a Edge Function confere consentimento, plano e cota,
 * manda as páginas ao provedor de IA e grava o resultado (com `atualizado_em` do servidor, que a
 * mescla aplica aqui). O "lendo…" é estado da tela, não do registro.
 */
export async function lerLaudo(docId: string, perfil: Perfil): Promise<ResultadoLeitura> {
  if (!temConsentimento(perfil)) return { tipo: "sem_consentimento" };
  const sb = await supabase();
  if (!sb || (typeof navigator !== "undefined" && !navigator.onLine)) return { tipo: "sem_rede" };
  try {
    // O documento, as páginas e o consentimento precisam estar no servidor antes da leitura.
    await sincronizar();
    const consentidoEm = perfil.consents?.ai_document_reading?.given_at;
    const { data, error } = await sb.functions.invoke<Resposta>("ler-laudo", { body: { document_id: docId, consentido_em: consentidoEm } });
    if (error || !data) throw new Error(error?.message ?? "sem resposta");
    const doc = medicalDocuments.obter(docId);
    const quando = data.atualizado_em ?? new Date().toISOString();
    if (data.status === "done") {
      const resumo = validarResumo(data.ai_summary);
      if (!resumo) throw new Error("resumo inválido");
      if (doc) medicalDocuments.mesclar([{ ...doc, ai_status: "done", ai_summary: resumo, atualizado_em: quando }]);
      return { tipo: "ok", resumo, restantes: data.restantes ?? 0 };
    }
    if (doc && data.status === "failed") medicalDocuments.mesclar([{ ...doc, ai_status: "failed", atualizado_em: quando }]);
    if (data.status === "sem_cota") return { tipo: "sem_cota", renova: data.renova ?? "" };
    if (data.status === "sem_consentimento") return { tipo: "sem_consentimento" };
    if (data.status === "premium") return { tipo: "premium" };
    if (data.status === "aguardando") return { tipo: "aguardando" };
    return { tipo: "falhou" };
  } catch {
    // RN-07: a tela mostra "Não consegui ler este laudo"; o servidor já marcou `failed` se chegou a tentar.
    return { tipo: "falhou" };
  }
}
