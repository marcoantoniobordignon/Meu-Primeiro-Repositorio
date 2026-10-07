"use client";

import { novoId } from "@/lib/dados/colecao";
import { calendarEvents, type CalendarEvent } from "@/lib/dados/colecoes";
import { temServidor } from "@/lib/familia/servidor";
import { chamarRpc, supabase } from "@/lib/supabase/client";
import { eventoDosDados, gerarIcs, itensDoFeed, type DadosEvento, type ItemCalendario } from "@dominio/calendario.ts";

/** RN-06: cria ou edita o evento próprio (offline: vai para a outbox e sobe depois). */
export function salvarEvento(d: DadosEvento, tz: string, autor: string, existente?: CalendarEvent | null): CalendarEvent {
  return calendarEvents.salvar({ id: existente?.id ?? novoId(), ...eventoDosDados(d, tz), criado_por: existente?.criado_por ?? autor, apagado_em: null });
}

export function excluirEvento(id: string): void {
  calendarEvents.apagar(id);
}

/** RN-09: "Adicionar ao meu calendário" gera um .ics de um evento. */
export function icsDoItem(item: ItemCalendario, agora = new Date()): Blob | null {
  const feed = itensDoFeed([item]);
  if (!feed.length) return null;
  return new Blob([gerarIcs(feed, agora)], { type: "text/calendar;charset=utf-8" });
}

export function baixarIcs(item: ItemCalendario): boolean {
  const blob = icsDoItem(item);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${item.titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "evento"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** RN-08: o link do feed. Precisa de servidor e de rede. */
export async function linkDoFeed(novo = false): Promise<string | null> {
  if (!temServidor()) return null;
  const sb = await supabase();
  if (!sb) return null;
  const { data, error } = await chamarRpc<string>(sb, "feed_calendario", { p_novo: novo });
  if (error || !data) throw new Error(error?.message ?? "sem token");
  return `${location.origin}/ics/${data}.ics`;
}
