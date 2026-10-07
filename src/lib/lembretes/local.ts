"use client";

import { useEffect } from "react";

import {
  appointmentQuestions,
  appointments,
  bellyPhotos,
  diaryEntries,
  diaryMilestoneStates,
  medicationDoses,
  medications,
  userExams,
} from "@/lib/dados/colecoes";
import { adiarDose, tomarDose } from "@/lib/medicamentos/acoes";
import { idbApagar, idbTodos, STORE_ACOES_PUSH } from "@/lib/offline/idb";
import type { Perfil } from "@/lib/perfil";
import { supabaseConfigurado } from "@/lib/supabase/client";
import { planejar, selecionarParaEnvio, type Enviado, type EstadoParaLembretes } from "@dominio/lembretes.ts";
import { podeAdiar } from "@dominio/medicamentos.ts";

/** O estado que o planejador de lembretes precisa, montado das coleções do aparelho. */
export function estadoDoAparelho(perfil: Perfil, autor: string, tz: string, agora = new Date()): EstadoParaLembretes {
  const entradas = diaryEntries.listar().filter((e) => e.criado_por === autor);
  return {
    agora,
    tz,
    dpp: perfil.modo === "gestacao" ? (perfil.dpp ?? null) : null,
    criadaEm: perfil.onboardingConcluidoEm,
    prefs: perfil.prefs,
    medicamentos: medications.listar(),
    doses: medicationDoses.listar(),
    exames: userExams.listar(),
    consultas: appointments.listar(),
    perguntas: appointmentQuestions.listar(),
    semanasComFoto: bellyPhotos.listar().map((f) => f.gest_week),
    marcos: {
      respondidos: entradas.flatMap((e) => (e.milestone_code ? [e.milestone_code] : [])),
      estados: diaryMilestoneStates.listar().filter((s) => s.criado_por === autor),
    },
  };
}

const CHAVE_ENVIADOS = "ninho.lembretes.enviados";

function lerEnviados(): Enviado[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_ENVIADOS) ?? "[]") as Enviado[];
  } catch {
    return [];
  }
}

function guardarEnviados(l: Enviado[], agora: Date) {
  // Uma semana basta para não repetir e para o limite diário.
  const recentes = l.filter((x) => agora.getTime() - new Date(x.enviado_em).getTime() < 7 * 86_400_000);
  try {
    localStorage.setItem(CHAVE_ENVIADOS, JSON.stringify(recentes));
  } catch {
    /* nada */
  }
}

/**
 * Sem servidor (app 100 % local), os lembretes saem do próprio aparelho enquanto o app está
 * aberto, com a mesma política do job (`selecionarParaEnvio`).
 */
export async function mostrarLembretesLocais(perfil: Perfil, autor: string, tz: string, agora = new Date()): Promise<number> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return 0;
  const enviados = lerEnviados();
  const saem = selecionarParaEnvio(planejar(estadoDoAparelho(perfil, autor, tz, agora)), { agora, tz, prefs: perfil.prefs, enviados });
  if (!saem.length) return 0;
  const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  for (const l of saem) {
    const opcoes = { body: l.corpo, tag: l.chave, data: { url: l.url, ref: l.ref, categoria: l.categoria } };
    try {
      if (reg) await reg.showNotification(l.titulo, opcoes);
      else new Notification(l.titulo, opcoes);
    } catch {
      /* sem notificação: segue */
    }
    enviados.push({ chave: l.chave, categoria: l.categoria, ref: l.ref, enviado_em: agora.toISOString(), essencial: l.essencial });
  }
  guardarEnviados(enviados, agora);
  return saem.length;
}

export interface AcaoPush {
  id: string;
  acao: "tomei" | "adiar";
  ref: string;
  quando: string;
}

/** "Tomei"/"Adiar" tocados na notificação com o app fechado (o service worker guardou): aplica aqui, offline-first. */
export async function aplicarAcoesPush(): Promise<number> {
  const acoes = await idbTodos<AcaoPush>(STORE_ACOES_PUSH);
  for (const a of acoes.sort((x, y) => x.quando.localeCompare(y.quando))) {
    const dose = medicationDoses.obter(a.ref);
    if (dose && !dose.apagado_em && dose.status === "pending") {
      if (a.acao === "tomei") tomarDose(dose, new Date(a.quando), "push");
      else if (podeAdiar(dose)) adiarDose(dose, new Date(a.quando));
    }
    await idbApagar(STORE_ACOES_PUSH, a.id);
  }
  return acoes.length;
}

/** Liga o fallback local (sem Supabase) e a aplicação das ações do push. */
export function useLembretesNoAparelho(perfil: Perfil | null | undefined, autor: string, tz: string): void {
  const ligado = Boolean(perfil);
  useEffect(() => {
    if (!ligado || !perfil) return;
    const aplicar = () => void aplicarAcoesPush();
    aplicar();
    const ouvir = (e: MessageEvent) => e.data?.tipo === "acao-push" && aplicar();
    navigator.serviceWorker?.addEventListener("message", ouvir);
    const local = supabaseConfigurado() ? null : window.setInterval(() => void mostrarLembretesLocais(perfil, autor, tz), 30_000);
    if (!supabaseConfigurado()) void mostrarLembretesLocais(perfil, autor, tz);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", ouvir);
      if (local) window.clearInterval(local);
    };
  }, [ligado, perfil, autor, tz]);
}
