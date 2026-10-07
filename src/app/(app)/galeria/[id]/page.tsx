"use client";

import { CloudUpload, Pencil, ScanText, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { tituloDoDocumento } from "@/components/features/galeria/ItemDocumento";
import { ResumoIa } from "@/components/features/galeria/ResumoIa";
import { Visualizador } from "@/components/features/galeria/Visualizador";
import { SheetPaywall } from "@/components/features/paywall/SheetPaywall";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Interruptor } from "@/components/ui/Interruptor";
import { Sheet } from "@/components/ui/Sheet";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { galeriaCopy as copy } from "@/copy/galeria";
import { track } from "@/lib/analytics";
import { useAguardandoEnvio } from "@/lib/arquivos/arquivos";
import { useColecao } from "@/lib/dados/colecao";
import { userExams } from "@/lib/dados/colecoes";
import { formatarLonga } from "@/lib/dates";
import { compartilharComParceiro, excluirDocumento, favoritar } from "@/lib/galeria/acoes";
import { darConsentimento, lerLaudo, temConsentimento } from "@/lib/galeria/ia";
import { paginasDo, semanaDoDocumento, temParceiro } from "@/lib/galeria/regras";
import { useGaleria } from "@/lib/galeria/useGaleria";
import { temPlano, type Perfil } from "@/lib/perfil";
import { nomeDoExame } from "@dominio/exames.ts";
import { ehUltrassom } from "@dominio/galeria.ts";
import { dataNoFuso } from "@dominio/tempo.ts";

/** Tela 3 "Documento": páginas com zoom, metadados, resumo da IA e ações. Tela 5: consentimento da IA. */
export default function PaginaDocumento() {
  const { id } = useParams<{ id: string }>();
  const { docs, paginas, perfil, membros, tz, podeEditar } = useGaleria();
  const exames = useColecao(userExams);
  const router = useRouter();
  const { mostrar } = useToast();
  const [excluindo, setExcluindo] = useState(false);
  const [consentindo, setConsentindo] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [avisoIa, setAvisoIa] = useState<string | null>(null);
  const doc = docs.find((d) => d.id === id);
  const kind = doc?.kind;
  const daqui = doc ? paginasDo(doc.id, paginas) : [];
  const aguardando = useAguardandoEnvio(daqui.map((p) => p.storage_path));

  useEffect(() => {
    if (kind) track("exam_doc_viewed", { kind });
  }, [id, kind]);

  if (!perfil) return null;
  if (!doc) return <Cabecalho titulo={copy.titulo} voltarPara="/galeria" />;
  const d = doc;
  const semana = semanaDoDocumento(perfil.dpp, d.exam_date);
  const exame = d.scheduled_exam_id ? exames.find((e) => e.id === d.scheduled_exam_id && !e.apagado_em) : undefined;

  async function ler(p: Perfil) {
    track("exam_doc_ai_read_requested", {});
    setAvisoIa(null);
    setLendo(true);
    const r = await lerLaudo(d.id, p);
    setLendo(false);
    if (r.tipo === "ok" || r.tipo === "falhou") track("exam_doc_ai_read_done", { ok: r.tipo === "ok" });
    if (r.tipo === "ok") setAvisoIa(copy.restantes(r.restantes));
    else if (r.tipo === "falhou") setAvisoIa(copy.falhouIa);
    else if (r.tipo === "sem_cota") setAvisoIa(copy.semCota(r.renova ? formatarLonga(dataNoFuso(new Date(r.renova), tz)) : ""));
    else if (r.tipo === "sem_rede") setAvisoIa(copy.semRedeIa);
    else if (r.tipo === "aguardando") setAvisoIa(copy.aguardandoIa);
    else if (r.tipo === "premium") setPaywall(true);
    else if (r.tipo === "sem_consentimento") setConsentindo(true);
  }

  /** RN-05: nunca automática; sem consentimento, pede antes de enviar qualquer coisa. Premium. */
  function pedirLeitura() {
    if (!perfil) return;
    if (!temPlano(perfil)) return setPaywall(true);
    if (!temConsentimento(perfil)) return setConsentindo(true);
    void ler(perfil);
  }

  return (
    <div>
      <Cabecalho
        titulo={tituloDoDocumento(d)}
        voltarPara="/galeria"
        acao={
          podeEditar ? (
            <button type="button" aria-label={copy.editarDoc} onClick={() => router.push(`/galeria/adicionar?id=${d.id}`)} className="grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave">
              <Pencil size={18} />
            </button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="tipo-meta">{[copy.tipos[d.kind], formatarLonga(d.exam_date), semana !== null ? copy.semana(semana) : null].filter(Boolean).join(" · ")}</p>
          {aguardando.size > 0 && (
            <span className="inline-flex items-center gap-1 rounded-pilula bg-acento-suave px-2 py-0.5 text-[11px] font-medium text-texto">
              <CloudUpload size={12} aria-hidden />
              {copy.aguardando}
            </span>
          )}
        </div>

        <Visualizador docId={d.id} paginas={daqui} />

        {(d.notes || exame) && (
          <Card>
            {exame && (
              <Link href={`/exames/${exame.id}`} className="inline-flex min-h-11 items-center text-[14px] font-medium text-primaria-texto">
                {copy.doExame(nomeDoExame(exame))}
              </Link>
            )}
            {d.notes && <p className="whitespace-pre-line tipo-corpo text-texto">{d.notes}</p>}
          </Card>
        )}

        {d.ai_status === "done" && d.ai_summary && (
          <Card>
            <ResumoIa resumo={d.ai_summary} />
          </Card>
        )}
        {d.ai_status === "failed" && !lendo && !avisoIa && <p className="tipo-corpo text-texto-mudo">{copy.falhouIa}</p>}
        {avisoIa && (
          <p className="tipo-corpo text-texto-mudo" role="status">
            {avisoIa}
          </p>
        )}

        {podeEditar && (
          <div className="flex flex-col gap-2">
            {d.ai_status !== "done" && (
              <Botao largura="total" tamanho="lg" variant="secundario" carregando={lendo} icone={<ScanText size={18} aria-hidden />} onClick={pedirLeitura}>
                {lendo ? copy.lendo : copy.lerLaudo}
              </Botao>
            )}
            {ehUltrassom(d.kind) && (
              <Botao largura="total" variant="secundario" icone={<Star size={18} aria-hidden fill={d.is_favorite ? "currentColor" : "none"} />} onClick={() => favoritar(d, !d.is_favorite)}>
                {d.is_favorite ? copy.desfavoritar : copy.favoritar}
              </Botao>
            )}
            {temParceiro(membros) && (
              <Card>
                <Interruptor rotulo={copy.compartilhar} apoio={copy.compartilharApoio} ligado={d.shared_with_partner} onMudar={(v) => compartilharComParceiro(d, v)} />
              </Card>
            )}
            <Botao largura="total" variant="fantasma" icone={<Trash2 size={18} aria-hidden />} onClick={() => setExcluindo(true)}>
              {copy.excluir}
            </Botao>
          </div>
        )}
      </div>

      <SheetConfirmar
        aberto={excluindo}
        titulo={copy.excluirTitulo}
        texto={copy.excluirTexto}
        confirmar={copy.excluir}
        cancelar={copy.cancelar}
        onFechar={() => setExcluindo(false)}
        onConfirmar={() => {
          void excluirDocumento(d).then(() => {
            track("exam_doc_deleted", {});
            mostrar(copy.excluido);
          });
          router.replace("/galeria");
        }}
      />

      {/* Tela 5: consentimento, na primeira vez. Nada é enviado antes do "Concordo". */}
      <Sheet
        aberto={consentindo}
        onFechar={() => setConsentindo(false)}
        titulo={copy.consentimentoTitulo}
        rodape={
          <div className="flex flex-col gap-2">
            <Botao
              largura="total"
              tamanho="lg"
              onClick={() => {
                if (!perfil) return;
                const atualizado = darConsentimento(perfil);
                track("exam_doc_ai_consent_given", {});
                setConsentindo(false);
                if (atualizado) void ler(atualizado);
              }}
            >
              {copy.consentir}
            </Botao>
            <Botao largura="total" variant="fantasma" onClick={() => setConsentindo(false)}>
              {copy.naoConsentir}
            </Botao>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          {copy.consentimentoTexto.map((t) => (
            <p key={t} className="tipo-corpo text-texto-mudo">
              {t}
            </p>
          ))}
        </div>
      </Sheet>

      <SheetPaywall aberto={paywall} gatilho={{ feature: "exam_gallery", trigger: "ai_reading" }} onFechar={() => setPaywall(false)} />
    </div>
  );
}
