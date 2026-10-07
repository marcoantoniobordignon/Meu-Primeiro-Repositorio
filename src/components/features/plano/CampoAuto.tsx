"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

import { CampoArea } from "@/components/ui/CampoArea";
import { CampoTexto } from "@/components/ui/CampoTexto";

const ESPERA_MS = 800;

interface Props {
  rotulo: string;
  valor: string | null;
  onSalvar: (valor: string | null) => void;
  desativado?: boolean;
  area?: boolean;
  maxLength: number;
  tipo?: ComponentProps<typeof CampoTexto>["type"];
  inputMode?: ComponentProps<typeof CampoTexto>["inputMode"];
  autoComplete?: string;
}

/** RN-01: salva sozinho 800 ms depois da última tecla (e na saída do campo). Vazio vira null. */
export function CampoAuto({ rotulo, valor, onSalvar, desativado, area, maxLength, tipo, inputMode, autoComplete }: Props) {
  const [texto, setTexto] = useState(valor ?? "");
  const pendente = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvar = useRef(onSalvar);
  salvar.current = onSalvar;

  const descarregar = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pendente.current !== null) {
      const v = pendente.current.trim();
      pendente.current = null;
      salvar.current(v ? v : null);
    }
  };

  useEffect(() => descarregar, []);

  function mudar(v: string) {
    setTexto(v);
    pendente.current = v;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(descarregar, ESPERA_MS);
  }

  const comum = { rotulo, value: texto, maxLength, disabled: desativado, onBlur: descarregar };
  return area ? (
    <CampoArea {...comum} rows={3} onChange={(e) => mudar(e.target.value)} />
  ) : (
    <CampoTexto {...comum} type={tipo} inputMode={inputMode} autoComplete={autoComplete} onChange={(e) => mudar(e.target.value)} />
  );
}
