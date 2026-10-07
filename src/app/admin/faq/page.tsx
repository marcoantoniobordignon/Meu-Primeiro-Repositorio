"use client";

import { useCallback, useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoArea } from "@/components/ui/CampoArea";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { Escolha } from "@/components/ui/Escolha";
import { useToast } from "@/components/ui/Toast";
import { faqCopy } from "@/copy/faq";
import { listarVerbetes, painelComServidor, perguntasAbertas, publicar, rejeitar, salvarRascunho, type PerguntaAberta, type VerbetePainel } from "@/lib/faq/admin";
import { useFaq } from "@/lib/faq/useFaq";
import { CATEGORIAS_FAQ, idDoVerbete, publicavel } from "@dominio/faq.ts";

const copy = faqCopy.admin;
type Motivo = "fora_do_escopo" | "pergunta_medica" | "repetida";

function vazio(): VerbetePainel {
  return { id: "", slug: "", name: "", aliases: [], category: "other", verdict: "caution", short_answer: "", details: null, condition_note: null, source_label: "", source_url: null, reviewed_by: null, reviewed_on: null, status: "draft" };
}

/** Tela 5 `/admin/faq` (só revisora ou admin): perguntas abertas por votos, editor de verbete, publicar e rejeitar com motivo. */
export default function PaginaAdminFaq() {
  const { verbetes: semente } = useFaq();
  const servidor = painelComServidor();
  const { mostrar } = useToast();
  const [lista, setLista] = useState<VerbetePainel[]>([]);
  const [abertas, setAbertas] = useState<PerguntaAberta[]>([]);
  const [filtro, setFiltro] = useState<"draft" | "published">("draft");
  const [atual, setAtual] = useState<VerbetePainel | null>(null);
  const [responde, setResponde] = useState<Set<string>>(new Set());
  const [revisor, setRevisor] = useState("");
  const [revisadoEm, setRevisadoEm] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState<Record<string, Motivo>>({});

  const carregar = useCallback(async () => {
    if (!servidor) return setLista(semente.map((v) => ({ ...v })));
    try {
      const [v, q] = await Promise.all([listarVerbetes(), perguntasAbertas()]);
      setLista(v);
      setAbertas(q);
    } catch {
      mostrar(copy.erro);
    }
  }, [servidor, semente, mostrar]);

  useEffect(() => {
    void carregar();
    // Recarrega só ao montar (a semente local não muda).
  }, [servidor]);

  async function salvar() {
    if (!atual) return;
    const v = { ...atual, id: atual.id || idDoVerbete(atual.slug) };
    try {
      await salvarRascunho(v);
      mostrar(copy.salvo);
      setAtual(v);
      await carregar();
    } catch {
      mostrar(copy.erro);
    }
  }

  async function publicarAtual() {
    if (!atual) return;
    if (!publicavel({ ...atual, reviewed_by: revisor, reviewed_on: revisadoEm })) return mostrar(copy.precisaRevisao);
    try {
      const v = { ...atual, id: atual.id || idDoVerbete(atual.slug) };
      await salvarRascunho(v);
      await publicar(v.id, [...responde], revisor.trim(), revisadoEm);
      mostrar(copy.publicado);
      setResponde(new Set());
      setAtual(null);
      await carregar();
    } catch {
      mostrar(copy.erro);
    }
  }

  const campo = (k: keyof VerbetePainel, rotulo: string, max: number, area = false) => {
    const valor = (atual?.[k] as string | null) ?? "";
    const mudar = (v: string) => setAtual((a) => (a ? { ...a, [k]: v || (k === "details" || k === "condition_note" || k === "source_url" ? null : "") } : a));
    return area ? <CampoArea rotulo={rotulo} value={valor} maxLength={max} rows={3} onChange={(e) => mudar(e.target.value)} /> : <CampoTexto rotulo={rotulo} value={valor} maxLength={max} onChange={(e) => mudar(e.target.value)} />;
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="tipo-saudacao text-texto">{copy.titulo}</h1>
      {!servidor && <p className="tipo-meta">{copy.demo}</p>}
      <p className="tipo-meta">{copy.iaRascunho}</p>

      <section aria-labelledby="abertas" className="flex flex-col gap-2">
        <h2 id="abertas" className="tipo-titulo-secao text-texto-mudo">
          {copy.abertas}
        </h2>
        {abertas.length === 0 ? (
          <p className="tipo-corpo text-texto-mudo">{copy.semAbertas}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {abertas.map((q) => (
              <li key={q.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex min-h-11 flex-1 items-center gap-2">
                      <input type="checkbox" className="size-5" checked={responde.has(q.id)} disabled={!atual} onChange={(e) => setResponde((s) => { const n = new Set(s); if (e.target.checked) n.add(q.id); else n.delete(q.id); return n; })} aria-label={`${copy.responde}: ${q.text}`} />
                      <span className="tipo-corpo text-texto">{q.text}</span>
                    </label>
                    <span className="tipo-meta">{copy.votos(q.votes_count)}</span>
                    <select aria-label={`${copy.rejeitar}: ${q.text}`} className="min-h-11 rounded-card border border-fio bg-superficie px-2 text-[14px] text-texto" value={motivo[q.id] ?? "fora_do_escopo"} onChange={(e) => setMotivo((m) => ({ ...m, [q.id]: e.target.value as Motivo }))}>
                      {(Object.keys(copy.motivos) as Motivo[]).map((m) => (
                        <option key={m} value={m}>
                          {copy.motivos[m]}
                        </option>
                      ))}
                    </select>
                    <Botao variant="fantasma" onClick={() => void rejeitar(q.id, motivo[q.id] ?? "fora_do_escopo").then(() => { mostrar(copy.rejeitada); void carregar(); }).catch(() => mostrar(copy.erro))}>
                      {copy.rejeitar}
                    </Botao>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="verbetes" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="verbetes" className="tipo-titulo-secao text-texto-mudo">
            {copy.verbetes}
          </h2>
          <Botao variant="secundario" onClick={() => setAtual(vazio())}>
            {copy.novo}
          </Botao>
        </div>
        <Escolha semRotulo rotulo={copy.verbetes} opcoes={[{ valor: "draft", rotulo: copy.rascunhos }, { valor: "published", rotulo: copy.publicados }]} valor={filtro} onMudar={setFiltro} />
        <ul className="grid gap-1 md:grid-cols-2">
          {lista
            .filter((v) => (filtro === "published" ? v.status === "published" : v.status !== "published"))
            .map((v) => (
              <li key={v.slug}>
                <button type="button" onClick={() => setAtual({ ...v })} className="flex min-h-11 w-full items-center justify-between rounded-card px-3 text-left text-[14px] text-texto hover:bg-superficie">
                  <span>{v.name}</span>
                  <span className="tipo-meta">{faqCopy.veredito[v.verdict]}</span>
                </button>
              </li>
            ))}
        </ul>
      </section>

      {atual && (
        <section aria-labelledby="editor" className="flex flex-col gap-3">
          <h2 id="editor" className="tipo-titulo-secao text-texto-mudo">
            {atual.id ? copy.editar : copy.novo}
          </h2>
          {campo("name", copy.campos.name, 80)}
          {campo("slug", copy.campos.slug, 80)}
          <CampoTexto rotulo={copy.campos.aliases} value={atual.aliases.join(", ")} onChange={(e) => setAtual({ ...atual, aliases: e.target.value.split(",").map((a) => a.trim()).filter(Boolean) })} />
          <Escolha rotulo={copy.campos.category} opcoes={CATEGORIAS_FAQ.map((c) => ({ valor: c, rotulo: faqCopy.categoria[c] }))} valor={atual.category} onMudar={(c) => setAtual({ ...atual, category: c })} />
          <Escolha rotulo={copy.campos.verdict} opcoes={(["safe", "caution", "avoid"] as const).map((v) => ({ valor: v, rotulo: faqCopy.veredito[v] }))} valor={atual.verdict} onMudar={(v) => setAtual({ ...atual, verdict: v })} />
          {campo("short_answer", copy.campos.short_answer, 200, true)}
          {campo("condition_note", copy.campos.condition_note, 200)}
          {campo("details", copy.campos.details, 800, true)}
          {campo("source_label", copy.campos.source_label, 200)}
          {campo("source_url", copy.campos.source_url, 500)}
          {servidor && (
            <>
              <Botao variant="secundario" onClick={() => void salvar()}>
                {copy.salvar}
              </Botao>
              <Card tom="suave">
                <div className="flex flex-col gap-3">
                  <p className="tipo-meta">{copy.precisaRevisao}</p>
                  <CampoTexto rotulo={copy.revisor} value={revisor} maxLength={120} onChange={(e) => setRevisor(e.target.value)} />
                  <CampoTexto rotulo={copy.revisadoEm} type="date" value={revisadoEm} onChange={(e) => setRevisadoEm(e.target.value)} />
                  <Botao onClick={() => void publicarAtual()}>{copy.publicar}</Botao>
                </div>
              </Card>
            </>
          )}
        </section>
      )}
    </div>
  );
}
