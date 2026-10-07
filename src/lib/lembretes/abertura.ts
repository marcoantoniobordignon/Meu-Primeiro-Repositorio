"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { track } from "@/lib/analytics";

/** Parâmetros que o service worker põe na URL do lembrete tocado. */
export function eventoDeAbertura(params: URLSearchParams): Parameters<typeof track> | null {
  if (params.get("origem") !== "lembrete") return null;
  const categoria = params.get("categoria");
  switch (categoria) {
    case "exam":
      return ["exam_reminder_opened", { code: params.get("code") ?? "custom" }];
    case "appt":
      return ["appt_reminder_opened", {}];
    case "belly":
      return ["belly_reminder_opened", {}];
    default:
      return null;
  }
}

/** Dispara `*_reminder_opened` uma vez quando a tela abre pelo toque no lembrete. */
export function useAberturaPorLembrete(): void {
  const params = useSearchParams();
  const chave = params.toString();
  useEffect(() => {
    const evento = eventoDeAbertura(new URLSearchParams(chave));
    if (evento) track(...evento);
  }, [chave]);
}
