"use client";

import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useState } from "react";

import { Foto } from "@/components/ui/Foto";
import { galeriaCopy as copy } from "@/copy/galeria";
import type { DocumentPage } from "@/lib/dados/colecoes";

const ZOOMS = [1, 1.5, 2, 3] as const;
const chave = (docId: string) => `ninho.galeria.pagina.${docId}`;

interface Props {
  docId: string;
  paginas: DocumentPage[];
}

const botao = "grid size-11 place-items-center rounded-pilula border border-fio bg-superficie text-texto disabled:opacity-60";

/**
 * Páginas com zoom (botões e toque duplo) e "Página x de n". Volta na página em que parou
 * (critério de aceite "na posição em que parei"), guardada só neste aparelho.
 */
export function Visualizador({ docId, paginas }: Props) {
  const [i, setI] = useState(0);
  const [nivel, setNivel] = useState(0);
  const n = paginas.length;

  useEffect(() => {
    try {
      const salva = Number(localStorage.getItem(chave(docId)) ?? 0);
      if (Number.isInteger(salva) && salva > 0) setI(salva);
    } catch {
      /* nada */
    }
  }, [docId]);

  const atual = Math.min(i, Math.max(0, n - 1));
  function ir(novo: number) {
    const alvo = Math.max(0, Math.min(n - 1, novo));
    setI(alvo);
    setNivel(0);
    try {
      localStorage.setItem(chave(docId), String(alvo));
    } catch {
      /* nada */
    }
  }

  if (!n) return null;
  const zoom = ZOOMS[nivel]!;
  const pagina = paginas[atual]!;
  const proporcao = pagina.width && pagina.height ? `${pagina.width} / ${pagina.height}` : "3 / 4";

  return (
    <section aria-roledescription="carrossel" aria-label={copy.pagina(atual + 1, n)} className="flex flex-col gap-2">
      <div className="relative">
        <div className="max-h-[60vh] overflow-auto rounded-[16px] bg-fio" onDoubleClick={() => setNivel((z) => (z === 0 ? 2 : 0))}>
          <div style={{ width: `${zoom * 100}%`, aspectRatio: proporcao }} className="transition-[width]">
            <Foto key={pagina.id} caminho={pagina.storage_path} alt={copy.pagina(atual + 1, n)} ajuste="contain" semArquivo={copy.semArquivo} />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 flex gap-2">
          <button type="button" className={botao} aria-label={copy.reduzir} disabled={nivel === 0} onClick={() => setNivel((z) => Math.max(0, z - 1))}>
            <ZoomOut size={18} />
          </button>
          <button type="button" className={botao} aria-label={copy.ampliar} disabled={nivel === ZOOMS.length - 1} onClick={() => setNivel((z) => Math.min(ZOOMS.length - 1, z + 1))}>
            <ZoomIn size={18} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className={botao} aria-label={copy.anterior} disabled={atual === 0} onClick={() => ir(atual - 1)}>
          <ChevronLeft size={20} />
        </button>
        <p className="tipo-meta flex-1 whitespace-nowrap text-center" aria-live="polite">
          {copy.pagina(atual + 1, n)}
        </p>
        <button type="button" className={botao} aria-label={copy.proxima} disabled={atual >= n - 1} onClick={() => ir(atual + 1)}>
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}
