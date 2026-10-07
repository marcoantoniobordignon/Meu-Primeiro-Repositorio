"use client";

import { useEffect, useRef } from "react";

import { carregarRecursos, fontesProntas } from "@/lib/retrospectiva/midia";
import { desenharSlide, estiloDoDocumento } from "@/lib/retrospectiva/render";
import { SEGUNDOS_POR_SLIDE, type Slide, type TipoRetro } from "@dominio/retrospectiva.ts";

/** A capa da retrospectiva em miniatura (9:16), desenhada pelo mesmo renderizador do player. Decorativa. */
export function MiniaturaRetro({ slide, kind, largura = 72 }: { slide: Slide | undefined; kind: TipoRetro; largura?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const foto = slide?.tipo === "cover" ? slide.foto : null;
  const nome = slide?.tipo === "cover" ? slide.nome : null;

  useEffect(() => {
    const c = canvas.current;
    if (!c || !slide) return;
    let vivo = true;
    void Promise.all([carregarRecursos(foto ? [foto] : []), fontesProntas()]).then(([{ recursos }]) => {
      const ctx = c.getContext("2d", { alpha: false });
      if (!vivo || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      // Desenha em 360 lógicos (o layout dos slides) e reduz: a tipografia fica proporcional.
      c.width = Math.round(largura * dpr * 2);
      c.height = Math.round(((largura * 16) / 9) * dpr * 2);
      desenharSlide(ctx, slide, SEGUNDOS_POR_SLIDE, recursos, estiloDoDocumento({ semMovimento: true, marca: false, kind }));
    });
    return () => {
      vivo = false;
    };
    // A capa só muda com a foto, o nome ou o tipo.
  }, [foto, nome, kind, largura]);

  return <canvas ref={canvas} aria-hidden className="shrink-0 rounded-[10px] bg-retro-noite" style={{ width: largura, height: (largura * 16) / 9 }} />;
}
