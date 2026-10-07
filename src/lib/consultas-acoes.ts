"use client";

import { novoId } from "@/lib/dados/colecao";
import { meuId } from "@/lib/familia/useFamilia";
import {
  appointmentMeasures,
  appointmentQuestions,
  appointments,
  type Appointment,
  type AppointmentMeasures,
  type AppointmentQuestion,
} from "@/lib/dados/colecoes";
import { idbApagar, idbSalvar, idbTodos, STORE_OUTBOX } from "@/lib/offline/idb";
import { chaveOutbox, type ItemOutbox } from "@/lib/offline/outbox";

import { converterConsultaAntiga, perguntasAoConcluir, proximaPosicao, statusInicial, type ConsultaAntiga, type RespostaPergunta } from "./consultas";

/** Funcionalidade 04 · escrita nas coleções (offline-first: tudo vai para a outbox). */

export type DadosConsulta = Pick<Appointment, "starts_at" | "kind" | "provider_name" | "provider_role" | "location">;

/** RN-01: nova com data passada já nasce `done`. Editar mantém o status. */
export function salvarConsulta(dados: DadosConsulta, existente?: Appointment | null, agora = new Date()): Appointment {
  return appointments.salvar({
    id: existente?.id ?? novoId(),
    ...dados,
    status: existente?.status ?? statusInicial(new Date(dados.starts_at), agora),
    followup_dismissed: existente?.followup_dismissed ?? false,
  });
}

/** RN-02/08/10: pergunta solta por padrão ("para a próxima consulta"). */
export function adicionarPergunta(texto: string, appointmentId: string | null = null, autor: string = meuId()): AppointmentQuestion {
  return appointmentQuestions.salvar({
    id: novoId(),
    criado_por: autor,
    appointment_id: appointmentId,
    text: texto.trim().slice(0, 280),
    was_asked: false,
    answer: null,
    position: proximaPosicao(appointmentQuestions.listar()),
  });
}

export function editarPergunta(p: AppointmentQuestion, texto: string): AppointmentQuestion {
  return appointmentQuestions.salvar({ ...p, text: texto.trim().slice(0, 280) });
}

export function apagarPergunta(p: AppointmentQuestion): void {
  appointmentQuestions.apagar(p.id);
}

export interface Conclusao {
  medidas: Omit<AppointmentMeasures, "id" | "appointment_id" | "atualizado_em" | "apagado_em"> | null;
  respostas: Record<string, RespostaPergunta>;
}

/** RN-02/03: conclui (passos opcionais), grava medidas e orientações e move as perguntas. */
export function concluirConsulta(c: Appointment, conclusao: Conclusao): Appointment {
  const salva = appointments.salvar({ ...c, status: "done" });
  if (conclusao.medidas) {
    appointmentMeasures.salvar({ id: c.id, appointment_id: c.id, ...conclusao.medidas, apagado_em: null });
  }
  for (const p of perguntasAoConcluir(c.id, appointmentQuestions.listar(), conclusao.respostas)) appointmentQuestions.salvar(p);
  return salva;
}

/** Cancelar: as perguntas não feitas vinculadas a ela voltam a ser soltas. Lembretes param (status). */
export function cancelarConsulta(c: Appointment): Appointment {
  for (const p of appointmentQuestions.listar()) {
    if (p.appointment_id === c.id && !p.was_asked) appointmentQuestions.salvar({ ...p, appointment_id: null });
  }
  return appointments.salvar({ ...c, status: "cancelled" });
}

/** RN-07: "Como foi?" uma única vez: dispensar não traz de volta. */
export function dispensarComoFoi(c: Appointment): Appointment {
  return appointments.salvar({ ...c, followup_dismissed: true });
}

/** RN-11: excluir apaga as medidas; as perguntas vinculadas voltam a ser soltas. */
export function excluirConsulta(c: Appointment): void {
  for (const p of appointmentQuestions.listar()) {
    if (p.appointment_id === c.id) appointmentQuestions.salvar({ ...p, appointment_id: null });
  }
  if (appointmentMeasures.obter(c.id)) appointmentMeasures.apagar(c.id);
  appointments.apagar(c.id);
}

const CHAVE_ANTIGA = "ninho.consultas";

/**
 * Uma vez por aparelho: a coleção da spec 05 (`ninho.consultas`) vira `appointments`
 * (+ `appointment_measures` para as notas) e os itens dela parados na outbox mudam de tabela.
 * O servidor faz a mesma conversão na migration 0003. Mesclar não reenvia o que já subiu.
 */
export async function migrarConsultasAntigas(): Promise<number> {
  let antigas: ConsultaAntiga[] = [];
  try {
    antigas = JSON.parse(localStorage.getItem(CHAVE_ANTIGA) ?? "[]") as ConsultaAntiga[];
  } catch {
    antigas = [];
  }
  if (antigas.length) {
    const convertidas = antigas.map(converterConsultaAntiga);
    appointments.mesclar(convertidas.map((c) => c.consulta));
    appointmentMeasures.mesclar(convertidas.flatMap((c) => (c.medidas ? [c.medidas] : [])));
  }
  try {
    localStorage.removeItem(CHAVE_ANTIGA);
  } catch {
    /* nada */
  }
  const fila = await idbTodos<ItemOutbox>(STORE_OUTBOX);
  for (const item of fila.filter((i) => (i.tabela as string) === "consultas")) {
    const { consulta } = converterConsultaAntiga(item.payload as unknown as ConsultaAntiga);
    const { atualizado_em, ...resto } = consulta;
    await idbApagar(STORE_OUTBOX, item.id);
    await idbSalvar<ItemOutbox>(STORE_OUTBOX, { ...item, id: chaveOutbox("appointments", consulta.id), tabela: "appointments", payload: { ...resto, atualizado_em: atualizado_em || new Date().toISOString() } });
  }
  return antigas.length;
}
