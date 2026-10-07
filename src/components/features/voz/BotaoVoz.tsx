"use client";

import { Mic } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { vozCopy as copy } from "@/copy/voz";
import { track } from "@/lib/analytics";
import { detalheDoRegistro, doBebe, mamadaEmAndamento, sonoEmAndamento } from "@/lib/bebe/registros";
import { registrosBebe, vozPendentes, type RegistroBebe } from "@/lib/dados/colecoes";
import { novoId } from "@/lib/dados/colecao";
import { estaOnline } from "@/lib/plataforma";
import { aplicarRegistros } from "@/lib/voz/aplicar";
import { interpretar, marcarInterpretacao } from "@/lib/voz/interpretar";
import type { ContextoVoz, ModoVoz } from "@/lib/voz/parser";
import { ouvir, suportaReconhecimento, type SessaoVoz } from "@/lib/voz/reconhecer";

type Estado = "parado" | "ouvindo" | "processando" | "entendi" | "nao_entendi" | "sem_suporte" | "sem_permissao";

interface Props {
  modo: ModoVoz;
  bebes?: { id: string; nome: string }[];
  bebeAtivoId?: string;
  /** "Corrigir": abre o sheet do tipo com o registro criado. */
  onCorrigir: (registro: RegistroBebe) => void;
  /** "Registrar à mão" no estado "não entendi". */
  onManual: (tipo: string) => void;
  /**
   * Intenções resolvidas no aparelho antes do parser (remédio, pergunta para o médico).
   * Devolve true quando tratou a frase.
   */
  onIntencaoLocal?: (texto: string) => boolean;
}

const MAX_MS = 20_000;
const TOQUE_CURTO_MS = 300;

/** VOZ-01..07, VOZ-11: segurar para falar, transcrição parcial, confirmação de uma linha. */
export function BotaoVoz({ modo, bebes, bebeAtivoId, onCorrigir, onManual, onIntencaoLocal }: Props) {
  const [estado, setEstado] = useState<Estado>("parado");
  const [parcial, setParcial] = useState("");
  const [resumo, setResumo] = useState("");
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [criados, setCriados] = useState<RegistroBebe[]>([]);
  const interpretacaoId = useRef<string | null | undefined>(null);
  const sessao = useRef<SessaoVoz | null>(null);
  const inicioToque = useRef(0);
  const inicioFala = useRef(0);
  const limite = useRef<number | null>(null);
  const fecharTimer = useRef<number | null>(null);
  const { mostrar } = useToast();

  useEffect(() => {
    if (!suportaReconhecimento()) setEstado("sem_suporte");
  }, []);

  const vibrar = (ms: number) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* sem haptics */
    }
  };

  const processar = useCallback(
    async (texto: string) => {
      if (texto && onIntencaoLocal?.(texto)) {
        setEstado("parado");
        return;
      }
      const t0 = Date.now();
      const todos = registrosBebe.listar();
      const contexto: ContextoVoz = {
        modo,
        agora: new Date(),
        bebes,
        bebeAtivoId,
        sonoEmAndamento: bebeAtivoId ? Boolean(sonoEmAndamento(todos, bebeAtivoId)) : false,
        ultimosRegistros: bebeAtivoId
          ? doBebe(todos, bebeAtivoId)
              .sort((a, b) => b.inicio.localeCompare(a.inicio))
              .slice(0, 3)
              .map((x) => ({ tipo: x.tipo, inicio: x.inicio, fim: x.fim, resumo: detalheDoRegistro(x) }))
          : undefined,
      };
      const r = await interpretar(texto, contexto);
      interpretacaoId.current = r.interpretacaoId;
      track("voz_interpretada", { tipos: r.registros.map((x) => x.tipo).join(","), n: r.registros.length, confianca: r.confianca, ms: Date.now() - t0 });

      if (r.registros.length === 0 || r.confianca < 0.6) {
        if (texto && !estaOnline()) {
          // VOZ-08: guarda a frase para interpretar com rede.
          vozPendentes.salvar({ id: novoId(), transcricao: texto, modo });
          mostrar(copy.guardei);
          setEstado("parado");
          return;
        }
        track("voz_nao_entendida", { motivo: texto ? "sem_tipo" : "vazio" });
        setSugestoes(r.sugestoes);
        setEstado("nao_entendi");
        return;
      }

      // Peito sem duração e com mamada já correndo: trata como não entendido para não duplicar.
      if (bebeAtivoId && r.registros.some((x) => x.tipo === "mamada" && x.dados.tipo === "peito" && x.inicio === x.fim) && mamadaEmAndamento(registrosBebe.listar(), bebeAtivoId)) {
        setSugestoes(["mamada"]);
        setEstado("nao_entendi");
        return;
      }

      const aplicado = aplicarRegistros(r.registros, bebeAtivoId);
      track("voz_aceita", { n: r.registros.length });
      void marcarInterpretacao(r.interpretacaoId, "aceita", true);
      vibrar(30);
      setResumo(r.resumo);
      setCriados(aplicado.registros);
      setEstado("entendi");
      if (fecharTimer.current) window.clearTimeout(fecharTimer.current);
      fecharTimer.current = window.setTimeout(() => setEstado((e) => (e === "entendi" ? "parado" : e)), 4000);
    },
    [modo, bebes, bebeAtivoId, mostrar, onIntencaoLocal],
  );

  const comecar = useCallback(() => {
    if (estado === "sem_suporte") return;
    inicioToque.current = Date.now();
    inicioFala.current = Date.now();
    setParcial("");
    const s = ouvir({
      onParcial: setParcial,
      onFinal: (texto) => {
        track("voz_transcrita", { ms: Date.now() - inicioFala.current, chars: texto.length });
        setParcial(texto);
        setEstado("processando");
        window.setTimeout(() => void processar(texto), 60);
      },
      onErro: (motivo) => {
        if (motivo === "sem_permissao") {
          track("voz_sem_permissao", {});
          setEstado("sem_permissao");
        }
      },
    });
    if (!s) {
      setEstado("sem_suporte");
      return;
    }
    sessao.current = s;
    vibrar(15);
    track("voz_iniciada", { modo, motor: "web_speech" });
    setEstado("ouvindo");
    limite.current = window.setTimeout(() => sessao.current?.parar(), MAX_MS);
  }, [estado, modo, processar]);

  const soltar = useCallback(() => {
    if (limite.current) window.clearTimeout(limite.current);
    if (!sessao.current) return;
    if (Date.now() - inicioToque.current < TOQUE_CURTO_MS) {
      sessao.current.cancelar();
      sessao.current = null;
      setEstado("parado");
      mostrar(copy.dica);
      return;
    }
    sessao.current.parar();
    sessao.current = null;
  }, [mostrar]);

  const ouvindo = estado === "ouvindo";

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        aria-label={copy.segure}
        aria-pressed={ouvindo}
        disabled={estado === "sem_suporte"}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          comecar();
        }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative grid size-36 touch-none select-none place-items-center rounded-full text-white transition-transform disabled:opacity-45 ${
          ouvindo ? "scale-105 bg-acento" : "bg-primaria shadow-mais active:scale-95"
        }`}
      >
        {ouvindo && (
          <>
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-acento/40" />
            <span aria-hidden className="absolute -inset-2 animate-pulse rounded-full border-2 border-acento/50" />
          </>
        )}
        <Mic size={40} strokeWidth={1.8} />
      </button>

      <div className="min-h-14 w-full text-center">
        {estado === "parado" && (
          <>
            <p className="tipo-saudacao text-texto">{copy.segure}</p>
            <p className="tipo-meta mt-1">{copy.exemplos[modo]}</p>
          </>
        )}
        {estado === "ouvindo" && (
          <>
            <p className="tipo-saudacao text-acento">{copy.ouvindo}</p>
            <p className="tipo-voz mt-1 min-h-5 text-texto">{parcial ? `“${parcial}”` : ""}</p>
          </>
        )}
        {estado === "processando" && <p className="tipo-saudacao text-texto-mudo">{copy.processando}</p>}
        {estado === "entendi" && (
          <Card tom="suave">
            <div className="flex items-center gap-3">
              <p className="tipo-corpo flex-1 text-left text-texto">
                {resumo} · <span className="font-medium text-primaria-texto">{copy.registrado}</span>
              </p>
              {criados[0] && (
                <Botao
                  variant="fantasma"
                  onClick={() => {
                    track("voz_corrigida", { tipo: criados[0]!.tipo });
                    void marcarInterpretacao(interpretacaoId.current, "corrigida", true);
                    setEstado("parado");
                    onCorrigir(criados[0]!);
                  }}
                >
                  {copy.corrigir}
                </Botao>
              )}
            </div>
          </Card>
        )}
        {estado === "nao_entendi" && (
          <Card tom="acento">
            <p className="tipo-saudacao text-texto">{copy.naoEntendi}</p>
            <p className="tipo-voz mt-1 text-texto-mudo">{copy.naoEntendiApoio(parcial)}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {sugestoes.map((s) => (
                <Botao key={s} variant="secundario" onClick={() => onManual(s)}>
                  {copy.tipos[s] ?? s}
                </Botao>
              ))}
              <Botao variant="fantasma" onClick={() => setEstado("parado")}>
                {copy.registrarAMao}
              </Botao>
            </div>
          </Card>
        )}
        {estado === "sem_suporte" && <p className="tipo-corpo text-texto-mudo">{copy.semSuporte}</p>}
        {estado === "sem_permissao" && <p className="tipo-corpo text-texto-mudo">{copy.semPermissao}</p>}
      </div>
    </div>
  );
}
