"use client";

import { Bath, Droplets, Milk, Moon } from "lucide-react";

import { Tile } from "@/components/ui/Tile";
import { bebeCopy as copy } from "@/copy/bebe";
import { detalheDoRegistro, mamadaEmAndamento, referenciaDoTile, sonoEmAndamento, tiposTile, ultimoDoTipo } from "@/lib/bebe/registros";
import { useColecao } from "@/lib/dados/colecao";
import { registrosBebe, type TipoRegistroBebe } from "@/lib/dados/colecoes";
import { inicialDoAutor } from "@/lib/familia/regras";
import { useFamilia } from "@/lib/familia/useFamilia";
import { formatarHora, formatarMinutos, haTempoCurto } from "@/lib/dates";
import { useAgora } from "@/lib/hooks/useAgora";

interface Props {
  bebeId: string;
  onAbrir: (tipo: TipoRegistroBebe) => void;
}

const icones = { sono: <Moon size={15} />, mamada: <Milk size={15} />, fralda: <Droplets size={15} />, banho: <Bath size={15} /> } as const;

/** BEB-01/02: quatro tiles com "há X" (30 s) e timers ao vivo (1 s). */
export function TilesBebe({ bebeId, onAbrir }: Props) {
  const todos = useColecao(registrosBebe);
  const { membros, meuId } = useFamilia();
  const sono = sonoEmAndamento(todos, bebeId);
  const mamada = mamadaEmAndamento(todos, bebeId);
  const agora = useAgora(sono || mamada ? 1000 : 30_000);

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiposTile.map((tipo) => {
        const aoVivo = tipo === "sono" ? sono : tipo === "mamada" ? mamada : undefined;
        const ultimo = ultimoDoTipo(todos, bebeId, tipo);
        const cor = tipo as "sono" | "mamada" | "fralda" | "banho";
        if (aoVivo) {
          const min = (agora.getTime() - new Date(aoVivo.inicio).getTime()) / 60_000;
          return (
            <Tile
              key={tipo}
              cor={cor}
              icone={icones[tipo]}
              nome={tipo === "sono" ? copy.tiles.dormindo : copy.tiles.mamando}
              contador={formatarMinutos(min)}
              meta={`${formatarHora(aoVivo.inicio)}${tipo === "mamada" ? ` · ${detalheDoRegistro(aoVivo)}` : ""}`}
              aoVivo
              inicial={inicialDoAutor(aoVivo.criado_por, meuId, membros)}
              onClick={() => onAbrir(tipo)}
            />
          );
        }
        return (
          <Tile
            key={tipo}
            cor={cor}
            icone={icones[tipo]}
            nome={copy.tiles[tipo]}
            contador={ultimo ? haTempoCurto(referenciaDoTile(ultimo), agora) : copy.tiles.naoRegistrado}
            meta={ultimo ? [formatarHora(referenciaDoTile(ultimo)), detalheDoRegistro(ultimo)].filter(Boolean).join(" · ") : undefined}
            inicial={ultimo ? inicialDoAutor(ultimo.criado_por, meuId, membros) : null}
            onClick={() => onAbrir(tipo)}
          />
        );
      })}
    </div>
  );
}
