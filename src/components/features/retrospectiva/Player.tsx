"use client";

import { Download, Pause, Play, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { retroCopy as copy } from "@/copy/retrospectiva";
import { track } from "@/lib/analytics";
import { carregarRecursos, fontesProntas } from "@/lib/retrospectiva/midia";
import { descricaoDoSlide, desenharComEntrada, estiloDoDocumento, type Recursos } from "@/lib/retrospectiva/render";
import { fotosDosSlides, SEGUNDOS_POR_SLIDE, type Slide, type TipoRetro } from "@dominio/retrospectiva.ts";

interface Props {
  kind: TipoRetro;
  slides: Slide[];
  onFechar: () => void;
  /** Destino do botão do último slide (RN: ponte para o app do bebê). */
  ponteHref: string;
}

/** Segurar por mais que isto pausa (e soltar não troca de slide). */
const SEGURAR_MS = 220;

/**
 * Tela 3 · player de stories (RN-06): 5 s por slide, fade de 0,4 s, toque à direita avança e à esquerda volta,
 * segurar pausa, X fecha. O desenho é o mesmo da exportação (`render.ts`); aqui só cuidamos do tempo e do toque.
 */
export function PlayerRetrospectiva({ kind, slides, onFechar, ponteHref }: Props) {
  const palco = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const apoio = useRef<HTMLCanvasElement | null>(null);
  const barras = useRef<(HTMLSpanElement | null)[]>([]);
  const [recursos, setRecursos] = useState<Recursos | null>(null);
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [segurando, setSegurando] = useState(false);
  const [fim, setFim] = useState(false);
  const [semMovimento, setSemMovimento] = useState(false);
  // Estado do tempo fora do React: o laço de quadros não re-renderiza a tela.
  const tempo = useRef({ t: 0, de: null as Slide | null, indice: 0 });
  const toque = useRef<{ x: number; inicio: number; timer: number | null; segurou: boolean } | null>(null);
  const caminhos = useMemo(() => fotosDosSlides(slides), [slides]);
  const chaveFotos = caminhos.join("|");

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSemMovimento(m.matches);
    const mudar = () => setSemMovimento(m.matches);
    m.addEventListener("change", mudar);
    return () => m.removeEventListener("change", mudar);
  }, []);

  // RN-11: o que estiver no aparelho (ou vier da rede) entra; o que faltar some do slide sem quebrar nada.
  useEffect(() => {
    let vivo = true;
    void Promise.all([carregarRecursos(caminhos), fontesProntas()]).then(([r]) => vivo && setRecursos(r.recursos));
    return () => {
      vivo = false;
    };
  }, [chaveFotos]);

  useEffect(() => {
    track("retro_opened", { kind });
  }, [kind]);

  useEffect(() => {
    const s = slides[indice];
    if (s && recursos) track("retro_slide_viewed", { index: indice, type: s.tipo });
    // Só quando o slide muda (ou começa a tocar).
  }, [indice, Boolean(recursos)]);

  const irPara = useCallback(
    (i: number) => {
      const n = slides.length;
      // Como nos stories: avançar depois do último fecha.
      if (i >= n) return onFechar();
      const destino = Math.max(0, Math.min(n - 1, i));
      const atual = tempo.current;
      if (destino === atual.indice) {
        atual.t = 0;
      } else {
        atual.de = slides[atual.indice] ?? null;
        atual.indice = destino;
        atual.t = 0;
      }
      setIndice(destino);
      setFim(false);
    },
    [slides, onFechar],
  );

  // Slides mudaram (editou e voltou): recomeça do primeiro.
  useEffect(() => {
    tempo.current = { t: 0, de: null, indice: 0 };
    setIndice(0);
    setFim(false);
  }, [slides]);

  // Pausa quando a aba some (e não "pula" o tempo ao voltar).
  useEffect(() => {
    const mudar = () => document.hidden && setPausado(true);
    document.addEventListener("visibilitychange", mudar);
    return () => document.removeEventListener("visibilitychange", mudar);
  }, []);

  // Tamanho do canvas = tamanho na tela × densidade (nítido em qualquer aparelho).
  useEffect(() => {
    const el = palco.current;
    const c = canvas.current;
    if (!el || !c) return;
    const ajustar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const { width } = el.getBoundingClientRect();
      const w = Math.round(width * dpr);
      const h = Math.round((width * 16) / 9 * dpr);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
        apoio.current ??= document.createElement("canvas");
        apoio.current.width = w;
        apoio.current.height = h;
      }
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // O laço de quadros.
  useEffect(() => {
    if (!recursos || slides.length === 0) return;
    const c = canvas.current;
    const ctx = c?.getContext("2d", { alpha: false });
    if (!c || !ctx) return;
    const estilo = estiloDoDocumento({ semMovimento, marca: false, kind });
    let quadro = 0;
    let antes = performance.now();
    const parado = pausado || segurando;
    const passo = (agora: number) => {
      const dt = Math.min(0.1, (agora - antes) / 1000);
      antes = agora;
      const st = tempo.current;
      if (!parado) st.t += dt;
      if (st.t >= SEGUNDOS_POR_SLIDE) {
        if (st.indice < slides.length - 1) {
          st.de = slides[st.indice] ?? null;
          st.indice += 1;
          st.t = 0;
          setIndice(st.indice);
        } else {
          st.t = SEGUNDOS_POR_SLIDE;
          setFim(true);
        }
      }
      const atual = slides[st.indice];
      if (atual && apoio.current) desenharComEntrada(ctx, apoio.current, st.de, atual, st.t, recursos, estilo);
      barras.current.forEach((b, i) => {
        if (b) b.style.transform = `scaleX(${i < st.indice ? 1 : i > st.indice ? 0 : Math.min(1, st.t / SEGUNDOS_POR_SLIDE)})`;
      });
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [recursos, slides, pausado, segurando, semMovimento, kind]);

  // Teclado: ← → navegam, espaço pausa, Esc fecha.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") irPara(tempo.current.indice + 1);
      else if (e.key === "ArrowLeft") irPara(tempo.current.indice - 1);
      else if (e.key === " " && (e.target as HTMLElement)?.tagName !== "BUTTON") {
        e.preventDefault();
        setPausado((p) => !p);
      } else if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [irPara, onFechar]);

  function aoApertar(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const alvo = e.currentTarget.getBoundingClientRect();
    const t = { x: (e.clientX - alvo.left) / alvo.width, inicio: performance.now(), timer: null as number | null, segurou: false };
    t.timer = window.setTimeout(() => {
      t.segurou = true;
      setSegurando(true);
    }, SEGURAR_MS);
    toque.current = t;
  }
  function aoSoltar() {
    const t = toque.current;
    toque.current = null;
    if (!t) return;
    if (t.timer) window.clearTimeout(t.timer);
    if (t.segurou) {
      setSegurando(false);
      return;
    }
    // RN-06: metade direita avança, metade esquerda volta.
    irPara(tempo.current.indice + (t.x >= 0.5 ? 1 : -1));
  }
  function aoCancelar() {
    const t = toque.current;
    toque.current = null;
    if (t?.timer) window.clearTimeout(t.timer);
    setSegurando(false);
  }

  const atual = slides[indice];
  const chromeVisivel = !segurando;
  const ehPonte = atual?.tipo === "bridge";
  const botaoChrome = "grid size-11 place-items-center rounded-pilula text-retro-luz transition-colors hover:bg-retro-luz/10 focus-visible:outline-retro-luz";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-retro-noite" role="dialog" aria-modal="true" aria-label={copy.player.rotulo}>
      <div ref={palco} className="relative aspect-[9/16] w-[min(100vw,calc(100dvh*9/16))] overflow-hidden bg-retro-noite sm:rounded-card">
        <canvas ref={canvas} aria-hidden className="absolute inset-0 size-full" />

        {/* Toque: metade esquerda volta, direita avança; segurar pausa. */}
        <div
          className="absolute inset-0 touch-none select-none"
          onPointerDown={aoApertar}
          onPointerUp={aoSoltar}
          onPointerCancel={aoCancelar}
          onPointerLeave={() => toque.current?.segurou && aoCancelar()}
          onContextMenu={(e) => e.preventDefault()}
          aria-hidden
        />

        {/* Topo: barras de progresso, pausa, editar, exportar, fechar. Some enquanto segura (para ver a foto inteira). */}
        <div className={`safe-top pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-retro-noite/45 to-transparent px-3 pb-6 pt-2 transition-opacity duration-300 ${chromeVisivel ? "opacity-100" : "opacity-0"}`}>
          <div className="flex gap-1" aria-hidden>
            {slides.map((s, i) => (
              <span key={`${s.tipo}-${i}`} className="h-[3px] flex-1 overflow-hidden rounded-pilula bg-retro-luz/30">
                <span
                  ref={(el) => {
                    barras.current[i] = el;
                  }}
                  className="block h-full origin-left rounded-pilula bg-retro-luz"
                  style={{ transform: `scaleX(${i < indice ? 1 : 0})` }}
                />
              </span>
            ))}
          </div>
          <div className="pointer-events-auto mt-1.5 flex items-center justify-between">
            <span className="pl-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-retro-luz/85">{kind === "final" ? copy.final : copy.previa}</span>
            <div className="flex items-center">
              <button type="button" className={botaoChrome} aria-label={pausado ? copy.player.continuar : copy.player.pausar} onClick={() => setPausado((p) => !p)}>
                {pausado ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
              </button>
              <Link href={`/memorias/retrospectiva/editar?kind=${kind}`} className={botaoChrome} aria-label={copy.player.editar}>
                <SlidersHorizontal size={18} aria-hidden />
              </Link>
              <Link href={`/memorias/retrospectiva/exportar?kind=${kind}`} className={botaoChrome} aria-label={copy.player.exportar}>
                <Download size={18} aria-hidden />
              </Link>
              <button type="button" className={botaoChrome} aria-label={copy.player.fechar} onClick={onFechar}>
                <X size={22} aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {/* Navegação acessível (o toque cobre a tela; teclado e leitor de tela usam estes). */}
        <button type="button" className="sr-only focus:not-sr-only focus:absolute focus:bottom-4 focus:left-4 focus:rounded-pilula focus:bg-retro-luz focus:px-4 focus:py-3 focus:text-retro-noite" onClick={() => irPara(indice - 1)}>
          {copy.player.anterior}
        </button>
        <button type="button" className="sr-only focus:not-sr-only focus:absolute focus:bottom-4 focus:right-4 focus:rounded-pilula focus:bg-retro-luz focus:px-4 focus:py-3 focus:text-retro-noite" onClick={() => irPara(indice + 1)}>
          {copy.player.proximo}
        </button>

        {/* A ponte é um botão de verdade, por cima do desenho. */}
        {ehPonte && (
          <div className="absolute inset-x-0 top-[70%] flex justify-center px-8">
            <Link
              href={ponteHref}
              className="anim-retro-surgir flex min-h-13 items-center rounded-pilula bg-retro-noite px-7 text-[15px] font-medium text-retro-luz"
            >
              {copy.player.ponte}
            </Link>
          </div>
        )}

        {!recursos && (
          <div className="absolute inset-0 grid place-items-center bg-retro-noite" role="status">
            <p className="font-serifa text-[22px] italic text-retro-luz-suave motion-safe:animate-pulse">{copy.player.carregando}</p>
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {atual ? `${copy.player.slide(indice + 1, slides.length)}. ${descricaoDoSlide(atual)}` : ""}
          {fim ? ` ${copy.player.fim}` : ""}
        </p>
      </div>
    </div>
  );
}
