"use client";

import { useEffect, useState } from "react";

import { useUrlArquivo } from "@/lib/arquivos/arquivos";

interface Props {
  rotulo: string;
  /** Áudio guardado (caminho no Storage) ou recém-gravado (blob). */
  caminho?: string | null;
  blob?: Blob | null;
}

/** Player nativo para o áudio do diário; o arquivo é local (ou baixado e guardado) e nunca sai do projeto. */
export function Audio({ rotulo, caminho, blob }: Props) {
  const remoto = useUrlArquivo(blob ? null : caminho);
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return setLocal(null);
    const u = URL.createObjectURL(blob);
    setLocal(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  const url = local ?? remoto.url;
  if (!url) return null;
  return <audio controls preload="metadata" src={url} aria-label={rotulo} className="h-11 w-full" />;
}
