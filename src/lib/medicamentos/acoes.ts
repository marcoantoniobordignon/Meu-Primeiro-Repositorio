"use client";

import { useEffect } from "react";

import { novoId } from "@/lib/dados/colecao";
import { medicationDoses, medications, type Medication, type MedicationDose } from "@/lib/dados/colecoes";
import { aoSincronizar } from "@/lib/offline/sync";
import { adiar, deveArquivar, dosesSemRegistro, reconciliarDoses } from "@dominio/medicamentos.ts";
import { fusoOuPadrao } from "@dominio/tempo.ts";

import { minutosDeAtraso } from "./regras";

/** Fuso do perfil (`profiles.tz`) ou o do aparelho. */
export function fusoDoAparelho(): string {
  try {
    return fusoOuPadrao(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return fusoOuPadrao(null);
  }
}

export function fusoDe(tz: string | null | undefined): string {
  return tz ? fusoOuPadrao(tz) : fusoDoAparelho();
}

/**
 * Materialização no aparelho (o job do servidor faz o mesmo, com os mesmos ids):
 * arquiva o que passou do fim (RN-11), reconcilia as doses dos próximos 7 dias e
 * marca "Sem registro" o que passou 2 h (RN-04). Sem mudança, não escreve nada.
 */
export function manterDoses(tz: string, agora = new Date(), apenas?: string): void {
  for (const m of medications.listarTodos()) {
    if (apenas && m.id !== apenas) continue;
    let atual = m;
    if (deveArquivar(m, agora, tz)) atual = medications.salvar({ ...m, is_active: false });
    const { criar, apagar } = reconciliarDoses(atual, medicationDoses.listarTodos(), agora, tz, (b) => ({ ...b, atualizado_em: "" }) as MedicationDose);
    for (const d of criar) medicationDoses.salvar(d);
    for (const id of apagar) medicationDoses.apagar(id);
  }
  for (const d of dosesSemRegistro(medicationDoses.listar(), agora)) medicationDoses.salvar({ ...d, status: "missed" });
}

/** Liga a manutenção: ao abrir, a cada minuto e depois de cada sincronização. */
export function useManutencaoDoses(tz: string | null | undefined, ligado = true): void {
  const fuso = fusoDe(tz);
  useEffect(() => {
    if (!ligado) return;
    const rodar = () => manterDoses(fuso);
    rodar();
    const t = window.setInterval(rodar, 60_000);
    const parar = aoSincronizar(rodar);
    return () => {
      window.clearInterval(t);
      parar();
    };
  }, [fuso, ligado]);
}

export function salvarMedicamento(dados: Omit<Medication, "atualizado_em">, tz: string): Medication {
  const salvo = medications.salvar(dados);
  manterDoses(tz, new Date(), salvo.id);
  return salvo;
}

export function arquivarMedicamento(m: Medication, tz: string): void {
  salvarMedicamento({ ...m, is_active: false }, tz);
}

/** Apaga o medicamento; o histórico de doses registradas fica (adesão), as pendentes futuras saem. */
export function apagarMedicamento(m: Medication, tz: string): void {
  medications.apagar(m.id);
  manterDoses(tz, new Date(), m.id);
}

/** RN-06: "Tomei" grava o horário real (agora, ou o ajustado no sheet). */
export function tomarDose(d: MedicationDose, quando: Date, source: NonNullable<MedicationDose["source"]>): { dose: MedicationDose; minutosAtraso: number } {
  const dose = medicationDoses.salvar({ ...d, status: "taken", taken_at: quando.toISOString(), source });
  return { dose, minutosAtraso: minutosDeAtraso(d, quando) };
}

/** RN-07: "Pular" fica registrada e não conta como tomada. */
export function pularDose(d: MedicationDose, source: NonNullable<MedicationDose["source"]> = "app"): MedicationDose {
  return medicationDoses.salvar({ ...d, status: "skipped", taken_at: null, source });
}

export function adiarDose(d: MedicationDose, agora = new Date()): MedicationDose {
  return medicationDoses.salvar(adiar(d, agora));
}

/** "Se necessário": cada tomada é uma dose nova, sem horário programado. */
export function tomarSeNecessario(m: Medication, quando: Date, source: NonNullable<MedicationDose["source"]>): MedicationDose {
  return medicationDoses.salvar({ id: novoId(), medication_id: m.id, scheduled_at: null, status: "taken", taken_at: quando.toISOString(), source, snooze_count: 0, snoozed_until: null });
}

/** "Desfazer" (voz, RN-12): volta a dose ao que era; uma dose criada na hora é apagada. */
export function desfazerDose(antes: MedicationDose | null, depois: MedicationDose): void {
  if (antes) medicationDoses.salvar(antes);
  else medicationDoses.apagar(depois.id);
}
