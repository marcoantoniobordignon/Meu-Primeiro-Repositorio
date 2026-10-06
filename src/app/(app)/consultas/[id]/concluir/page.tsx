"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SheetConsulta } from "@/components/features/consultas/SheetConsulta";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoArea } from "@/components/ui/CampoArea";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { Interruptor } from "@/components/ui/Interruptor";
import { Progresso } from "@/components/ui/Progresso";
import { useToast } from "@/components/ui/Toast";
import { consultasCopy as copy } from "@/copy/consultas";
import { track } from "@/lib/analytics";
import { lerMedida, temMedidas, type CampoMedida } from "@/lib/consultas";
import { concluirConsulta } from "@/lib/consultas-acoes";
import { useColecao } from "@/lib/dados/colecao";
import { appointmentMeasures, appointmentQuestions, appointments } from "@/lib/dados/colecoes";
import { useFuso } from "@/lib/hooks/useFuso";
import { usePerfil } from "@/lib/perfil";
import { dataDeRetorno, diasDeRetorno } from "@dominio/consultas.ts";
import { dataNoFuso } from "@dominio/tempo.ts";
import { dataCurta } from "@/lib/exames/regras";

const CAMPOS: CampoMedida[] = ["weight_kg", "bp_sys", "bp_dia", "fundal_height_cm", "fetal_heart_rate"];

/** RN-03: três passos, todos opcionais (medidas; perguntas; orientações e retorno). Concluir muda para `done`. */
export default function PaginaConcluir() {
  const { id } = useParams<{ id: string }>();
  const todas = useColecao(appointments);
  const perguntas = useColecao(appointmentQuestions);
  const perfil = usePerfil();
  const tz = useFuso();
  const router = useRouter();
  const { mostrar } = useToast();
  const c = todas.find((x) => x.id === id);
  const existentes = appointmentMeasures.obter(id);
  const [passo, setPasso] = useState(1);
  const [valores, setValores] = useState<Record<CampoMedida, string>>(() => ({
    weight_kg: existentes?.weight_kg?.toString().replace(".", ",") ?? "",
    bp_sys: existentes?.bp_sys?.toString() ?? "",
    bp_dia: existentes?.bp_dia?.toString() ?? "",
    fundal_height_cm: existentes?.fundal_height_cm?.toString().replace(".", ",") ?? "",
    fetal_heart_rate: existentes?.fetal_heart_rate?.toString() ?? "",
  }));
  const [respostas, setRespostas] = useState<Record<string, { was_asked: boolean; answer: string | null }>>({});
  const [notas, setNotas] = useState(existentes?.notes_after ?? "");
  const [retorno, setRetorno] = useState<string | null>(null);
  const [tocou, setTocou] = useState(false);

  const lidos = useMemo(() => Object.fromEntries(CAMPOS.map((k) => [k, lerMedida(k, valores[k])])) as Record<CampoMedida, number | null | "erro">, [valores]);
  const comErro = CAMPOS.some((k) => lidos[k] === "erro");
  const candidatas = perguntas.filter((p) => !p.was_asked && (p.appointment_id === null || p.appointment_id === id)).sort((a, b) => a.position - b.position);

  if (!c) return <Cabecalho titulo={copy.concluir} voltarPara="/consultas" />;
  const dataConsulta = dataNoFuso(new Date(c.starts_at), tz);
  const sugestao = perfil?.dpp ? { dias: diasDeRetorno(perfil.dpp, dataConsulta), data: dataDeRetorno(perfil.dpp, dataConsulta) } : null;

  function avancar() {
    setTocou(true);
    if (passo === 1 && comErro) return;
    setTocou(false);
    setPasso((p) => p + 1);
  }

  function concluir(marcarRetorno: boolean) {
    if (!c) return;
    if (comErro) {
      setPasso(1);
      setTocou(true);
      return;
    }
    const medidas = Object.fromEntries(CAMPOS.map((k) => [k, lidos[k] === "erro" ? null : lidos[k]])) as Record<CampoMedida, number | null>;
    const notesAfter = notas.trim().slice(0, 1000) || null;
    concluirConsulta(c, { medidas: temMedidas(medidas) || notesAfter || existentes ? { ...medidas, notes_after: notesAfter } : null, respostas });
    track("appt_completed", { has_measures: temMedidas(medidas) });
    for (const r of Object.values(respostas)) if (r.was_asked) track("appt_question_asked", {});
    mostrar(copy.concluida);
    if (marcarRetorno && sugestao) setRetorno(sugestao.data);
    else router.push(`/consultas/${c.id}`);
  }

  return (
    <div>
      <Cabecalho titulo={copy.concluir} voltarPara={`/consultas/${id}`} />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-1">
        <div>
          <Progresso atual={passo} total={3} rotulo={copy.passo(passo)} />
          <p className="tipo-meta mt-2">{copy.passo(passo)}</p>
        </div>

        {passo === 1 && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="tipo-saudacao text-texto">{copy.medidas}</h2>
              <p className="tipo-meta">{copy.medidasApoio}</p>
            </div>
            <CampoTexto rotulo={copy.peso} inputMode="decimal" value={valores.weight_kg} onChange={(e) => setValores((v) => ({ ...v, weight_kg: e.target.value }))} erro={lidos.weight_kg === "erro" ? copy.confira : undefined} />
            <fieldset>
              <legend className="tipo-titulo-secao mb-1.5 text-texto-mudo">{copy.pressao}</legend>
              <div className="grid grid-cols-2 gap-3">
                <CampoTexto rotulo={copy.sistolica} inputMode="numeric" value={valores.bp_sys} onChange={(e) => setValores((v) => ({ ...v, bp_sys: e.target.value }))} erro={lidos.bp_sys === "erro" ? copy.confira : undefined} />
                <CampoTexto rotulo={copy.diastolica} inputMode="numeric" value={valores.bp_dia} onChange={(e) => setValores((v) => ({ ...v, bp_dia: e.target.value }))} erro={lidos.bp_dia === "erro" ? copy.confira : undefined} />
              </div>
            </fieldset>
            <CampoTexto rotulo={copy.alturaUterina} ajuda={copy.alturaUterinaApoio} inputMode="decimal" value={valores.fundal_height_cm} onChange={(e) => setValores((v) => ({ ...v, fundal_height_cm: e.target.value }))} erro={lidos.fundal_height_cm === "erro" ? copy.confira : undefined} />
            <CampoTexto rotulo={copy.batimentos} inputMode="numeric" value={valores.fetal_heart_rate} onChange={(e) => setValores((v) => ({ ...v, fetal_heart_rate: e.target.value }))} erro={lidos.fetal_heart_rate === "erro" ? copy.confira : undefined} />
          </section>
        )}

        {passo === 2 && (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="tipo-saudacao text-texto">{copy.perguntas}</h2>
              <p className="tipo-meta">{copy.perguntasApoio}</p>
            </div>
            {candidatas.length === 0 && <p className="tipo-corpo text-texto-mudo">{copy.pautaVazia}</p>}
            {candidatas.map((p) => {
              const r = respostas[p.id];
              return (
                <Card key={p.id} compacto>
                  <Interruptor rotulo={p.text} ligado={Boolean(r?.was_asked)} onMudar={(v) => setRespostas((x) => ({ ...x, [p.id]: { was_asked: v, answer: x[p.id]?.answer ?? null } }))} />
                  {r?.was_asked && (
                    <div className="mt-2">
                      <CampoTexto rotulo={copy.resposta} id={`resposta-${p.id}`} maxLength={500} value={r.answer ?? ""} onChange={(e) => setRespostas((x) => ({ ...x, [p.id]: { was_asked: true, answer: e.target.value } }))} />
                    </div>
                  )}
                </Card>
              );
            })}
          </section>
        )}

        {passo === 3 && (
          <section className="flex flex-col gap-4">
            <h2 className="tipo-saudacao text-texto">{copy.orientacoes}</h2>
            <CampoArea rotulo={copy.orientacoesCampo} value={notas} maxLength={1000} contador rows={4} onChange={(e) => setNotas(e.target.value)} />
            {sugestao && (
              <Card tom="suave">
                <h3 className="tipo-titulo-secao text-primaria-texto">{copy.retorno}</h3>
                <p className="tipo-corpo mt-1 text-texto">{copy.sugestao(sugestao.dias, dataCurta(sugestao.data))}</p>
                <p className="tipo-meta mt-1">{copy.ritmo}</p>
              </Card>
            )}
          </section>
        )}

        {tocou && comErro && <p className="text-[12px] text-erro">{copy.confira}</p>}

        {passo < 3 ? (
          <div className="flex gap-2">
            <Botao largura="total" variant="secundario" onClick={() => setPasso((p) => p + 1)} disabled={passo === 1 && comErro}>
              {copy.pular}
            </Botao>
            <Botao largura="total" onClick={avancar}>
              {copy.continuar}
            </Botao>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sugestao && (
              <Botao largura="total" tamanho="lg" onClick={() => concluir(true)}>
                {copy.marcarRetorno}
              </Botao>
            )}
            <Botao largura="total" variant={sugestao ? "secundario" : "primario"} onClick={() => concluir(false)}>
              {copy.finalizar}
            </Botao>
          </div>
        )}
      </div>
      <SheetConsulta
        aberto={retorno !== null}
        dataSugerida={retorno}
        onFechar={() => {
          setRetorno(null);
          router.push("/consultas");
        }}
      />
    </div>
  );
}
