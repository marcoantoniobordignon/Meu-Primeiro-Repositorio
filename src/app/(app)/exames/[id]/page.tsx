"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { resumoDoExame } from "@/components/features/exames/LinhaExame";
import { SheetConcluirExame } from "@/components/features/exames/SheetConcluirExame";
import { SheetMarcarExame } from "@/components/features/exames/SheetMarcarExame";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { examesCopy as copy } from "@/copy/exames";
import { track } from "@/lib/analytics";
import { useUrlArquivo } from "@/lib/arquivos/arquivos";
import { useColecao } from "@/lib/dados/colecao";
import { medicalDocuments, userExams } from "@/lib/dados/colecoes";
import { apagarPersonalizado, desmarcarExame, dispensarExame, restaurarExame } from "@/lib/exames/acoes";
import { useAberturaPorLembrete } from "@/lib/lembretes/abertura";
import { secaoDoExame } from "@/lib/exames/regras";
import { useFuso } from "@/lib/hooks/useFuso";
import { exameDoCatalogo, nomeDoExame } from "@dominio/exames.ts";
import { dataNoFuso } from "@dominio/tempo.ts";

/** RN-04: os botões "Já fiz" e "Remarquei" do lembrete do dia seguinte chegam pela URL. */
function AcaoDoLembrete({ onJaFiz, onRemarquei }: { onJaFiz: () => void; onRemarquei: () => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const acao = params.get("acao");
  useAberturaPorLembrete();
  useEffect(() => {
    if (!acao) return;
    if (acao === "ja_fiz") onJaFiz();
    if (acao === "remarquei") onRemarquei();
    router.replace(window.location.pathname);
  }, [acao, onJaFiz, onRemarquei, router]);
  return null;
}

/** Detalhe: nome simples, para que serve, janela, estado e ações (RN-06/08/10). */
export default function PaginaExame() {
  const { id } = useParams<{ id: string }>();
  const exames = useColecao(userExams);
  const docs = useColecao(medicalDocuments);
  const tz = useFuso();
  const router = useRouter();
  const { mostrar } = useToast();
  const [marcando, setMarcando] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const e = exames.find((x) => x.id === id);
  const doc = e?.document_id ? docs.find((d) => d.id === e.document_id) : undefined;
  const { url } = useUrlArquivo(doc?.storage_path);

  if (!e) return <Cabecalho titulo={copy.titulo} voltarPara="/exames" />;
  const cat = exameDoCatalogo(e.catalog_code);
  const secao = secaoDoExame(e, dataNoFuso(new Date(), tz));

  return (
    <div>
      <Suspense>
        <AcaoDoLembrete
          onJaFiz={() => e.status === "scheduled" && setConcluindo(true)}
          onRemarquei={() => {
            if (e.status !== "scheduled") return;
            desmarcarExame(e);
            setMarcando(true);
          }}
        />
      </Suspense>
      <Cabecalho titulo={nomeDoExame(e)} voltarPara="/exames" />
      <div className="flex flex-col gap-4 px-5 pt-1">
        {cat && (
          <Card>
            <h2 className="tipo-titulo-secao text-texto-mudo">{copy.paraQueServe}</h2>
            <p className="tipo-corpo mt-1 text-texto">{cat.short_desc}</p>
          </Card>
        )}
        <Card>
          <h2 className="tipo-titulo-secao text-texto-mudo">{copy.estado}</h2>
          <p className="tipo-corpo mt-1 text-texto">
            {copy.estados[e.status]} · {resumoDoExame(e, tz)}
          </p>
          {e.notes && <p className="tipo-meta mt-1">{e.notes}</p>}
          {doc && url && (
            <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-[14px] font-medium text-primaria-texto">
              {copy.verResultado}
            </a>
          )}
        </Card>
        <p className="tipo-meta">{copy.referencia}</p>

        <div className="flex flex-col gap-2">
          {(e.status === "to_schedule" || e.status === "scheduled") && (
            <Botao largura="total" tamanho="lg" onClick={() => (secao === "anteriores" ? setConcluindo(true) : setMarcando(true))}>
              {secao === "anteriores" ? copy.jaFiz : e.status === "scheduled" ? copy.remarcar : copy.marcar}
            </Botao>
          )}
          {e.status === "scheduled" && (
            <Botao largura="total" variant="secundario" onClick={() => setConcluindo(true)}>
              {copy.concluir}
            </Botao>
          )}
          {e.status !== "dismissed" && e.status !== "done" && (
            <Botao
              largura="total"
              variant="fantasma"
              onClick={() => {
                dispensarExame(e);
                track("exam_dismissed", { code: e.catalog_code ?? "custom" });
                mostrar(copy.dispensado);
              }}
            >
              {copy.dispensar}
            </Botao>
          )}
          {e.status === "dismissed" && (
            <Botao
              largura="total"
              variant="secundario"
              onClick={() => {
                restaurarExame(e);
                track("exam_restored", {});
                mostrar(copy.restaurado);
              }}
            >
              {copy.restaurar}
            </Botao>
          )}
          {!e.catalog_code && (
            <Botao
              largura="total"
              variant="fantasma"
              onClick={() => {
                apagarPersonalizado(e);
                router.push("/exames");
              }}
            >
              {copy.apagar}
            </Botao>
          )}
        </div>
      </div>
      <SheetMarcarExame exame={marcando ? e : null} tz={tz} onFechar={() => setMarcando(false)} />
      <SheetConcluirExame exame={concluindo ? e : null} semData={secao === "anteriores"} tz={tz} onFechar={() => setConcluindo(false)} />
    </div>
  );
}
