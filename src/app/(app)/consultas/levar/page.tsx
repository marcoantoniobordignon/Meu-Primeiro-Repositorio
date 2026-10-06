"use client";

import { Share2 } from "lucide-react";
import { useEffect } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { consultasCopy as copy } from "@/copy/consultas";
import { track } from "@/lib/analytics";
import { compartilharTexto } from "@/lib/compartilhar";
import { resumoMedidas, ultimasMedidas } from "@/lib/consultas";
import { useColecao } from "@/lib/dados/colecao";
import { appointmentMeasures, appointmentQuestions, appointments, medications, userExams } from "@/lib/dados/colecoes";
import { formatarQuando } from "@/lib/dates";
import { dataCurta } from "@/lib/exames/regras";
import { useAgora } from "@/lib/hooks/useAgora";
import { useFuso } from "@/lib/hooks/useFuso";
import { ativos, descreverAgenda } from "@/lib/medicamentos/regras";
import { pautaDaConsulta, proximaConsulta } from "@dominio/consultas.ts";
import { nomeDoExame } from "@dominio/exames.ts";
import { dataNoFuso, somarDiasISO } from "@dominio/tempo.ts";

/** RN-09: só leitura. Perguntas pendentes, medicamentos ativos, exames dos últimos 30 dias e últimas medidas. */
export default function PaginaLevar() {
  const consultas = useColecao(appointments);
  const perguntas = useColecao(appointmentQuestions);
  const medidas = useColecao(appointmentMeasures);
  const meds = useColecao(medications);
  const exames = useColecao(userExams);
  const tz = useFuso();
  const agora = useAgora(60_000);
  const { mostrar } = useToast();

  useEffect(() => {
    track("appt_bring_opened", {});
  }, []);

  const proxima = proximaConsulta(consultas, agora, tz);
  const pauta = pautaDaConsulta(proxima, proxima, perguntas);
  const remedios = ativos(meds).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const desde = somarDiasISO(dataNoFuso(agora, tz), -30);
  const examesRecentes = exames
    .filter((e) => e.status === "done" && e.done_on && e.done_on >= desde)
    .sort((a, b) => (b.done_on ?? "").localeCompare(a.done_on ?? ""));
  const ultimas = ultimasMedidas(consultas, medidas);

  const linhas = {
    perguntas: pauta.map((p) => p.text),
    remedios: remedios.map((m) => [m.name, m.dose, descreverAgenda(m)].filter(Boolean).join(" · ")),
    exames: examesRecentes.map((e) => `${nomeDoExame(e)} · ${dataCurta(e.done_on!)}`),
    medidas: ultimas ? [`${resumoMedidas(ultimas.medidas)} (${formatarQuando(ultimas.consulta.starts_at, agora)})`] : [],
  };

  async function compartilhar() {
    track("appt_share_tapped", {});
    const bloco = (titulo: string, itens: string[]) => [titulo, ...(itens.length ? itens.map((i) => `• ${i}`) : [`• ${copy.levarNada}`])].join("\n");
    const texto = [
      copy.resumoTitulo,
      bloco(copy.levarPerguntas, linhas.perguntas),
      bloco(copy.levarRemedios, linhas.remedios),
      bloco(copy.levarExames, linhas.exames),
      bloco(copy.levarMedidas, linhas.medidas),
    ].join("\n\n");
    if ((await compartilharTexto(texto)) === "copiado") mostrar(copy.copiado);
  }

  const secao = (titulo: string, itens: string[]) => (
    <Card>
      <h2 className="tipo-titulo-secao text-texto-mudo">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="tipo-corpo mt-1 text-texto-mudo">{copy.levarNada}</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1.5">
          {itens.map((i) => (
            <li key={i} className="tipo-corpo text-texto">
              {i}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <div>
      <Cabecalho titulo={copy.levar} voltarPara="/consultas" />
      <div className="flex flex-col gap-3 px-5 pt-1">
        <p className="tipo-meta">{copy.levarApoio}</p>
        {secao(copy.levarPerguntas, linhas.perguntas)}
        {secao(copy.levarRemedios, linhas.remedios)}
        {secao(copy.levarExames, linhas.exames)}
        {secao(copy.levarMedidas, linhas.medidas)}
        <Botao largura="total" tamanho="lg" icone={<Share2 size={18} aria-hidden />} onClick={() => void compartilhar()}>
          {copy.compartilhar}
        </Botao>
      </div>
    </div>
  );
}
