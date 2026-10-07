"use client";

import { Check, Lock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoArea } from "@/components/ui/CampoArea";
import { Card } from "@/components/ui/Card";
import { Interruptor } from "@/components/ui/Interruptor";
import { Sheet } from "@/components/ui/Sheet";
import { retroCopy as copy } from "@/copy/retrospectiva";
import { track } from "@/lib/analytics";
import { formatarComAno } from "@/lib/dates";
import { useFamilia } from "@/lib/familia/useFamilia";
import { alternarSlide, escolherFrase } from "@/lib/retrospectiva/acoes";
import { useRetrospectiva } from "@/lib/retrospectiva/useRetrospectiva";
import { COM_FRASE, MAX_FRASE, podeOcultar, primeiraFrase, type Escolha, type Slide, type TipoRetro, type TipoSlide } from "@dominio/retrospectiva.ts";

const E = copy.editor;

/** A frase que o slide mostra agora (para a linha do editor). */
function fraseAtual(s: Slide | undefined): string | null {
  if (!s) return null;
  if (s.tipo === "discovery" || s.tipo === "first_kick" || s.tipo === "quote" || s.tipo === "partner") return s.frase.texto;
  if (s.tipo === "sex_name") return s.sexo?.texto ?? s.nome?.texto ?? null;
  return null;
}

function Conteudo() {
  const params = useSearchParams();
  const kind: TipoRetro = params.get("kind") === "final" ? "final" : "preview";
  const r = useRetrospectiva(kind);
  const { papel } = useFamilia();
  const [frase, setFrase] = useState<TipoSlide | null>(null);

  if (!r.perfil) return null;
  if (papel !== "mae") return <p className="tipo-corpo px-5 pt-10 text-texto-mudo">{copy.player.soGestante}</p>;

  const ocultos = new Set(r.config.hidden_slides);
  const presentes = new Map(r.possiveis.map((s) => [s.tipo, s] as const));
  // Os slides de frase que ainda não existem podem ser adicionados escolhendo uma frase (RN-04).
  const adicionaveis = COM_FRASE.filter((t) => !presentes.has(t));

  function alternar(tipo: TipoSlide) {
    const res = alternarSlide(r.semente, kind, tipo, r.meuId);
    if (res?.oculto) track("retro_slide_hidden", { type: tipo });
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Cabecalho titulo={E.titulo} voltarPara={`/memorias/retrospectiva?kind=${kind}`} />
      <p className="tipo-corpo px-5 text-texto-mudo">{E.apoio}</p>

      <ol className="flex flex-col gap-2 px-5">
        {r.possiveis.map((s, i) => {
          const obrigatorio = !podeOcultar(s.tipo);
          const visivel = obrigatorio || !ocultos.has(s.tipo);
          const texto = fraseAtual(s);
          return (
            <li key={s.tipo}>
              <Card compacto>
                <div className={`flex flex-col gap-2 transition-opacity ${visivel ? "" : "opacity-60"}`}>
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="tipo-meta w-5 text-right tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {obrigatorio ? (
                        <div className="flex min-h-11 items-center gap-3">
                          <span className="flex-1 text-[15px] font-medium text-texto">{E.nomes[s.tipo]}</span>
                          <span className="tipo-meta flex items-center gap-1">
                            <Lock size={12} aria-hidden />
                            {E.obrigatorio}
                          </span>
                        </div>
                      ) : (
                        <Interruptor rotulo={E.nomes[s.tipo] ?? s.tipo} apoio={E.ocultar} ligado={visivel} onMudar={() => alternar(s.tipo)} />
                      )}
                    </div>
                  </div>
                  {texto && (
                    <div className="ml-8 flex items-start gap-3">
                      <p className="line-clamp-2 flex-1 font-serifa text-[16px] italic leading-snug text-texto">“{texto}”</p>
                      <Botao variant="fantasma" onClick={() => setFrase(s.tipo)} aria-label={`${E.trocarFrase}: ${E.nomes[s.tipo]}`}>
                        {E.trocarFrase}
                      </Botao>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      {adicionaveis.length > 0 && (
        <section className="flex flex-col gap-2 px-5">
          <h2 className="tipo-titulo-secao text-texto-mudo">{E.adicionar}</h2>
          {adicionaveis.map((t) => (
            <Card key={t} compacto>
              <div className="flex min-h-11 items-center gap-3">
                <span className="flex-1 text-[15px] font-medium text-texto">{E.nomes[t]}</span>
                <Botao variant="secundario" onClick={() => setFrase(t)} aria-label={`${E.escolherFrase}: ${E.nomes[t]}`}>
                  {E.escolherFrase}
                </Botao>
              </div>
            </Card>
          ))}
        </section>
      )}

      <SheetFrase
        tipo={frase}
        kind={kind}
        onFechar={() => setFrase(null)}
        entradas={r.dados.entradas}
        autora={r.meuId}
        escolhida={frase ? r.config.chosen_entries[frase] : undefined}
        onEscolher={(e) => {
          if (frase) escolherFrase(r.semente, kind, frase, e, r.meuId);
          setFrase(null);
        }}
      />
    </div>
  );
}

function SheetFrase({
  tipo,
  onFechar,
  entradas,
  autora,
  escolhida,
  onEscolher,
}: {
  tipo: TipoSlide | null;
  kind: TipoRetro;
  onFechar: () => void;
  entradas: { id: string; body: string | null; entry_date: string; criado_por?: string | null }[];
  autora: string;
  escolhida: Escolha | undefined;
  onEscolher: (e: Escolha | null) => void;
}) {
  const [texto, setTexto] = useState("");
  useEffect(() => {
    if (tipo) setTexto(escolhida && "texto" in escolhida ? escolhida.texto : "");
    // Só ao abrir para outro slide.
  }, [tipo]);
  const comTexto = entradas.filter((e) => primeiraFrase(e.body)).sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  // RN-04: as do parceiro aparecem separadas e só entram se ela escolher.
  const minhas = comTexto.filter((e) => e.criado_por === autora);
  const doParceiro = comTexto.filter((e) => e.criado_por && e.criado_por !== autora);
  const marcada = escolhida && "entrada" in escolhida ? escolhida.entrada : null;
  const padrao = tipo === "discovery" || tipo === "first_kick" || tipo === "sex_name";

  const opcao = (e: (typeof comTexto)[number]) => (
    <li key={e.id}>
      <button
        type="button"
        onClick={() => onEscolher({ entrada: e.id })}
        aria-pressed={marcada === e.id}
        className={`flex min-h-13 w-full items-start gap-3 rounded-card px-3 py-3 text-left transition-colors ${marcada === e.id ? "bg-primaria-suave" : "active:bg-primaria-suave"}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-serifa text-[16px] leading-snug text-texto">{primeiraFrase(e.body)}</span>
          <span className="tipo-meta mt-1 block">{formatarComAno(e.entry_date)}</span>
        </span>
        {marcada === e.id && <Check size={18} aria-hidden className="mt-1 shrink-0 text-primaria-texto" />}
      </button>
    </li>
  );

  return (
    <Sheet aberto={tipo !== null} onFechar={onFechar} titulo={tipo ? E.fraseTitulo(E.nomes[tipo] ?? tipo) : undefined}>
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="tipo-titulo-secao mb-1 text-texto-mudo">{E.minhas}</h3>
          {minhas.length ? <ul className="-mx-3 flex flex-col">{minhas.map(opcao)}</ul> : <p className="tipo-corpo text-texto-mudo">{E.semEntradas}</p>}
        </section>
        {doParceiro.length > 0 && (
          <section>
            <h3 className="tipo-titulo-secao mb-1 text-texto-mudo">{E.doParceiro}</h3>
            <ul className="-mx-3 flex flex-col">{doParceiro.map(opcao)}</ul>
          </section>
        )}
        <section className="flex flex-col gap-2">
          <h3 className="tipo-titulo-secao text-texto-mudo">{E.digitar}</h3>
          <CampoArea rotulo={E.digitarRotulo} semRotulo value={texto} maxLength={MAX_FRASE} contador rows={3} onChange={(e) => setTexto(e.target.value)} />
          <Botao variant="secundario" disabled={!texto.trim()} onClick={() => onEscolher({ texto })}>
            {E.usarTexto}
          </Botao>
        </section>
        {escolhida && (
          <Botao variant="fantasma" onClick={() => onEscolher(null)}>
            {padrao ? E.padrao : E.remover}
          </Botao>
        )}
      </div>
    </Sheet>
  );
}

/** Tela 4 · editar: ocultar slides (RN-05) e trocar a frase dos slides de diário (RN-04). */
export default function PaginaEditar() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
