"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoArea } from "@/components/ui/CampoArea";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { Escolha } from "@/components/ui/Escolha";
import { Interruptor } from "@/components/ui/Interruptor";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { calendarioCopy as copy } from "@/copy/calendario";
import { track } from "@/lib/analytics";
import { excluirEvento, salvarEvento } from "@/lib/calendario/acoes";
import { useCalendario } from "@/lib/calendario/useCalendario";
import type { CalendarEvent } from "@/lib/dados/colecoes";
import { formatarHora, formatarLonga } from "@/lib/dates";
import { CATEGORIAS_EVENTO, validarEvento, type CategoriaEvento, type DadosEvento, type LembreteEvento } from "@dominio/calendario.ts";
import { dataISOValida, dataNoFuso, horaNoFuso } from "@dominio/tempo.ts";

type OpcaoLembrete = "nenhum" | "0" | "60" | "1440";

function Formulario({ existente, dataInicial }: { existente?: CalendarEvent; dataInicial: string }) {
  const { tz, meuId } = useCalendario();
  const router = useRouter();
  const { mostrar } = useToast();
  const [titulo, setTitulo] = useState(existente?.title ?? "");
  const [categoria, setCategoria] = useState<CategoriaEvento>(existente?.category ?? "other");
  const [diaInteiro, setDiaInteiro] = useState(existente?.all_day ?? false);
  const [data, setData] = useState(existente ? (existente.all_day ? existente.all_day_date! : dataNoFuso(new Date(existente.starts_at!), tz)) : dataInicial);
  const [hora, setHora] = useState(existente?.starts_at ? horaNoFuso(new Date(existente.starts_at), tz) : "");
  const [notas, setNotas] = useState(existente?.notes ?? "");
  const [lembrete, setLembrete] = useState<OpcaoLembrete>(existente?.remind_offset_minutes === null || existente?.remind_offset_minutes === undefined ? (existente ? "nenhum" : "60") : (String(existente.remind_offset_minutes) as OpcaoLembrete));
  const [visivel, setVisivel] = useState(existente?.visible_to_partner ?? true);
  const [tocou, setTocou] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const dados: DadosEvento = {
    title: titulo,
    category: categoria,
    all_day: diaInteiro,
    data,
    hora: diaInteiro ? null : hora || null,
    notes: notas,
    remind_offset_minutes: (lembrete === "nenhum" ? null : Number(lembrete)) as LembreteEvento,
    visible_to_partner: visivel,
  };
  const erros = validarEvento(dados);

  function salvar() {
    setTocou(true);
    if (erros.length) return;
    const ev = salvarEvento(dados, tz, meuId, existente);
    if (!existente) track("cal_event_created", { category: ev.category });
    mostrar(copy.salvo);
    router.replace(`/calendario/dia?d=${data}`);
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-8 pt-1">
      <CampoTexto rotulo={copy.tituloCampo} value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} erro={tocou && erros.includes("sem_titulo") ? copy.tituloErro : tocou && erros.includes("titulo_longo") ? copy.tituloLongo : undefined} />
      <Escolha rotulo={copy.categoria} opcoes={CATEGORIAS_EVENTO.map((c) => ({ valor: c, rotulo: copy.categorias[c] }))} valor={categoria} onMudar={setCategoria} />
      <Card compacto>
        <Interruptor rotulo={copy.diaInteiroCampo} ligado={diaInteiro} onMudar={setDiaInteiro} />
      </Card>
      <CampoTexto rotulo={copy.data} type="date" value={data} onChange={(e) => setData(e.target.value)} erro={tocou && erros.includes("sem_data") ? copy.dataErro : undefined} />
      {!diaInteiro && <CampoTexto rotulo={copy.hora} type="time" value={hora} onChange={(e) => setHora(e.target.value)} erro={tocou && erros.includes("sem_hora") ? copy.horaErro : undefined} />}
      <Escolha
        rotulo={copy.lembrete}
        opcoes={(["nenhum", "0", "60", "1440"] as const).map((v) => ({ valor: v, rotulo: copy.lembretes[v] }))}
        valor={lembrete}
        onMudar={setLembrete}
      />
      <CampoArea rotulo={copy.observacao} value={notas} maxLength={500} rows={3} onChange={(e) => setNotas(e.target.value)} />
      <Card compacto>
        <Interruptor rotulo={copy.visivelParceiro} apoio={copy.visivelParceiroApoio} ligado={visivel} onMudar={setVisivel} />
      </Card>
      <Botao largura="total" tamanho="lg" onClick={salvar}>
        {copy.salvar}
      </Botao>
      {existente && (
        <>
          <Botao variant="fantasma" onClick={() => setExcluindo(true)}>
            {copy.excluir}
          </Botao>
          <SheetConfirmar
            aberto={excluindo}
            titulo={copy.excluirTitulo}
            texto={copy.excluirTexto}
            confirmar={copy.excluir}
            cancelar={copy.cancelar}
            onFechar={() => setExcluindo(false)}
            onConfirmar={() => {
              excluirEvento(existente.id);
              mostrar(copy.excluido);
              router.replace("/calendario");
            }}
          />
        </>
      )}
    </div>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const { perfil, eventos, hoje, podeCriar, tz } = useCalendario();
  const id = params.get("id");
  const pedido = params.get("data") ?? "";
  const existente = id ? eventos.find((e) => e.id === id) : undefined;
  if (!perfil) return null;
  if (id && !existente) return <Cabecalho titulo={copy.titulo} voltarPara="/calendario" />;
  if (!podeCriar) {
    // Parceiro: o evento visível é só leitura (RN-11).
    if (!existente) return <Cabecalho titulo={copy.titulo} voltarPara="/calendario" />;
    return (
      <div>
        <Cabecalho titulo={existente.title} voltarPara="/calendario" />
        <div className="px-5 pt-1">
          <p className="tipo-corpo text-texto">
            {existente.all_day ? formatarLonga(existente.all_day_date!) : `${formatarLonga(dataNoFuso(new Date(existente.starts_at!), tz))} · ${formatarHora(existente.starts_at!)}`}
          </p>
        </div>
      </div>
    );
  }
  return (
    <>
      <Cabecalho titulo={existente ? copy.editar : copy.novo} voltarPara="/calendario" />
      <Formulario key={existente?.id ?? "novo"} existente={existente} dataInicial={dataISOValida(pedido) ? pedido : hoje} />
    </>
  );
}

/** Tela 4 "Novo evento ou editar" (só eventos próprios, RN-03/06). */
export default function PaginaEvento() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
