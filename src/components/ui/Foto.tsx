"use client";

import { ImageOff } from "lucide-react";

import { useUrlArquivo } from "@/lib/arquivos/arquivos";

interface Props {
  /** Caminho no Storage (o blob do aparelho ou baixado e guardado). */
  caminho: string | null | undefined;
  alt: string;
  /** `cover` preenche (miniaturas); `contain` mostra inteira (tela cheia). */
  ajuste?: "cover" | "contain";
  semArquivo?: string;
}

/**
 * Foto guardada pelo app (barriga, diário). É um blob local: `next/image` não otimiza blob,
 * então aqui vai `<img>` com URL de objeto, que nunca sai do aparelho.
 */
export function Foto({ caminho, alt, ajuste = "cover", semArquivo }: Props) {
  const { url, carregando } = useUrlArquivo(caminho);
  if (!url) {
    return (
      <span role="img" aria-label={carregando ? alt : (semArquivo ?? alt)} className={`grid size-full place-items-center bg-fio text-texto-mudo ${carregando ? "animate-pulse" : ""}`}>
        {!carregando && <ImageOff size={18} aria-hidden />}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={`size-full ${ajuste === "cover" ? "object-cover" : "object-contain"}`} />;
}
