"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { useToast } from "@/components/ui/Toast";
import { adminCopy as copy } from "@/copy/admin";
import { cardsDoCorpo, categorias, corDaCategoria, DIAS_DA_SEMANA, normalizarConteudo, slugify, validarConteudo, type Problema } from "@/lib/admin/conteudo";
import { fonteAdmin } from "@/lib/admin/fonte";
import { FRASE_ENCAMINHAMENTO, type Categoria, type Conteudo } from "@/lib/conteudo/banco";

import { PreviewStory } from "./PreviewStory";

interface Props {
  inicial: Conteudo;
  novo: boolean;
  slugsExistentes: string[];
}

const ed = copy.conteudo.editor;

/** Formulário + preview lado a lado. Salvar só passa com as regras da spec 07 em dia. */
export function EditorConteudo({ inicial, novo, slugsExistentes }: Props) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [c, setC] = useState<Conteudo>(inicial);
  const [slugManual, setSlugManual] = useState(!novo);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!slugManual) setC((atual) => ({ ...atual, slug: slugify(atual.titulo) }));
  }, [c.titulo, slugManual]);

  const problemas = useMemo(() => validarConteudo(c, slugsExistentes), [c, slugsExistentes]);
  const cards = useMemo(() => cardsDoCorpo(c.corpo_md), [c.corpo_md]);
  const erroDe = (campo: Problema["campo"]) => (tentou ? problemas.find((p) => p.campo === campo)?.mensagem : undefined);

  function mudar<K extends keyof Conteudo>(campo: K, valor: Conteudo[K]) {
    setC((atual) => ({ ...atual, [campo]: valor }));
  }

  function numero(v: string): number | null {
    return v === "" ? null : Number(v);
  }

  async function salvar(publicar: boolean) {
    setTentou(true);
    const final = normalizarConteudo({ ...c, publicado: publicar ? true : c.publicado });
    if (validarConteudo(final, slugsExistentes).length > 0) return;
    setSalvando(true);
    try {
      await fonteAdmin().salvarConteudo(final);
      mostrar(publicar ? ed.publicadoToast : ed.salvo);
      router.push("/admin/conteudo");
    } catch {
      mostrar(ed.erro);
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!window.confirm(ed.apagarConfirma)) return;
    await fonteAdmin().apagarConteudo(c.id);
    mostrar(ed.apagado);
    router.push("/admin/conteudo");
  }

  const ehSemana = c.categoria === "semana";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar(false);
        }}
      >
        <CampoTexto rotulo={ed.titulo} value={c.titulo} onChange={(e) => mudar("titulo", e.target.value)} erro={erroDe("titulo")} autoFocus={novo} />
        <CampoTexto
          rotulo={ed.slug}
          value={c.slug}
          onChange={(e) => {
            setSlugManual(true);
            mudar("slug", slugify(e.target.value));
          }}
          ajuda={ed.slugAjuda}
          erro={erroDe("slug")}
          disabled={!novo}
        />

        <Bloco titulo={ed.categoria}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ed.categoria}>
            {categorias.map((cat) => (
              <button
                key={cat}
                type="button"
                role="radio"
                aria-checked={c.categoria === cat}
                onClick={() => setC((atual) => ({ ...atual, categoria: cat, cor_token: corDaCategoria[cat], premium: cat === "semana" ? false : atual.premium }))}
                className={`inline-flex min-h-10 items-center gap-2 rounded-pilula border px-3.5 text-[13px] font-medium ${c.categoria === cat ? "border-acento bg-acento-suave text-texto" : "border-fio bg-superficie text-texto"}`}
              >
                <span aria-hidden className={`size-3 rounded-full ${pontoCor[corDaCategoria[cat]]}`} />
                {copy.conteudo.categoriaNome[cat]}
              </button>
            ))}
          </div>
          {ehSemana && <p className="tipo-meta mt-2">{ed.semanaAvisos}</p>}
        </Bloco>

        <Bloco titulo={ed.faixaTitulo} apoio={ed.faixaApoio} erro={erroDe("faixa") ?? erroDe("semana_categoria")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CampoNumero rotulo={ed.semanaMin} valor={c.semana_min} min={1} max={42} onMudar={(v) => mudar("semana_min", v)} />
            <CampoNumero rotulo={ed.semanaMax} valor={c.semana_max} min={1} max={42} onMudar={(v) => mudar("semana_max", v)} />
            <CampoNumero rotulo={ed.mesMin} valor={c.mes_bebe_min} min={0} max={24} onMudar={(v) => mudar("mes_bebe_min", v)} />
            <CampoNumero rotulo={ed.mesMax} valor={c.mes_bebe_max} min={0} max={24} onMudar={(v) => mudar("mes_bebe_max", v)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="tipo-titulo-secao mb-1.5 block text-texto-mudo">{ed.diaDaSemana}</span>
              <select
                value={c.dia_da_semana ?? ""}
                onChange={(e) => mudar("dia_da_semana", numero(e.target.value))}
                className="block min-h-13 w-full rounded-card border border-fio bg-superficie px-4 text-[16px] text-texto focus:outline-none focus:ring-2 focus:ring-primaria"
              >
                <option value="">{ed.qualquerDia}</option>
                {DIAS_DA_SEMANA.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-[12px] text-texto-mudo">{ed.diaAjuda}</span>
            </label>
            <CampoNumero rotulo={ed.minutos} valor={c.minutos_leitura} min={1} max={15} onMudar={(v) => mudar("minutos_leitura", v ?? 1)} erro={erroDe("minutos")} />
          </div>
        </Bloco>

        <Bloco titulo={ed.corpo} apoio={ed.corpoAjuda} erro={erroDe("corpo") ?? erroDe("palavras") ?? erroDe("frase")}>
          <textarea
            value={c.corpo_md}
            onChange={(e) => mudar("corpo_md", e.target.value)}
            rows={16}
            spellCheck
            aria-label={ed.corpo}
            className="block w-full resize-y rounded-card border border-fio bg-superficie px-4 py-3 font-sans text-[15px] leading-[1.5] text-texto focus:outline-none focus:ring-2 focus:ring-primaria"
          />
          {!c.corpo_md.trim().endsWith(FRASE_ENCAMINHAMENTO) && (
            <div className="mt-2">
              <Botao variant="fantasma" onClick={() => mudar("corpo_md", `${c.corpo_md.trim()}\n\n---\n\n${FRASE_ENCAMINHAMENTO}`)}>
                {ed.inserirFrase}
              </Botao>
            </div>
          )}
        </Bloco>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
          <Interruptor rotulo={ed.premium} ajuda={ed.premiumAjuda} ligado={c.premium} onMudar={(v) => mudar("premium", v)} desativado={ehSemana} />
          <Interruptor rotulo={ed.publicado} ajuda={ed.publicadoAjuda} ligado={c.publicado} onMudar={(v) => mudar("publicado", v)} />
        </div>

        {tentou && problemas.length > 0 && (
          <div role="alert" className="rounded-card bg-acento-suave px-4 py-3">
            <p className="tipo-titulo-secao text-texto">{ed.problemas}</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {problemas.map((p) => (
                <li key={`${p.campo}-${p.mensagem}`} className="text-[13px] text-texto">
                  {p.mensagem}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-fio pt-4">
          <Botao type="submit" carregando={salvando}>
            {ed.salvar}
          </Botao>
          {!c.publicado && (
            <Botao variant="secundario" onClick={() => void salvar(true)} disabled={salvando}>
              {ed.salvarPublicar}
            </Botao>
          )}
          {!novo && !c.publicado && (
            <Botao variant="fantasma" onClick={() => void apagar()} disabled={salvando}>
              {ed.apagar}
            </Botao>
          )}
          <span className="ml-auto">
            <Botao variant="fantasma" onClick={() => router.push("/admin/conteudo")}>
              {ed.voltar}
            </Botao>
          </span>
        </div>
      </form>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="tipo-titulo-secao mb-3 text-texto-mudo">{ed.preview}</p>
        <PreviewStory titulo={c.titulo} categoria={c.categoria} cor={corDaCategoria[c.categoria]} cards={cards} />
      </aside>
    </div>
  );
}

const pontoCor: Record<string, string> = {
  primaria: "bg-primaria",
  acento: "bg-acento",
  banho: "bg-banho",
  fralda: "bg-fralda",
  sono: "bg-sono",
  mamada: "bg-mamada",
};

function Bloco({ titulo, apoio, erro, children }: { titulo: string; apoio?: string; erro?: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="tipo-titulo-secao text-texto-mudo">{titulo}</legend>
      {apoio && <p className="tipo-meta mb-2.5 mt-0.5">{apoio}</p>}
      {!apoio && <div className="h-2.5" />}
      {children}
      {erro && (
        <p role="alert" className="mt-1.5 text-[12px] text-erro">
          {erro}
        </p>
      )}
    </fieldset>
  );
}

function CampoNumero({ rotulo, valor, min, max, onMudar, erro }: { rotulo: string; valor: number | null; min: number; max: number; onMudar: (v: number | null) => void; erro?: string }) {
  return (
    <CampoTexto
      rotulo={rotulo}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={valor ?? ""}
      onChange={(e) => onMudar(e.target.value === "" ? null : Number(e.target.value))}
      erro={erro}
    />
  );
}

function Interruptor({ rotulo, ajuda, ligado, onMudar, desativado = false }: { rotulo: string; ajuda: string; ligado: boolean; onMudar: (v: boolean) => void; desativado?: boolean }) {
  return (
    <label className={`flex flex-1 items-center gap-3 rounded-card border border-fio bg-superficie px-4 py-3 ${desativado ? "opacity-50" : ""}`}>
      <input type="checkbox" role="switch" checked={ligado} disabled={desativado} onChange={(e) => onMudar(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-pilula transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primaria ${ligado ? "bg-primaria" : "bg-fio"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${ligado ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-texto">{rotulo}</span>
        <span className="tipo-meta block">{ajuda}</span>
      </span>
    </label>
  );
}

export type { Categoria };
