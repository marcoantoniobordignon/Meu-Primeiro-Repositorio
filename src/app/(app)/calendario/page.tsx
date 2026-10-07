"use client";

import { Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Agenda } from "@/components/features/calendario/Agenda";
import { Mes } from "@/components/features/calendario/Mes";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Escolha } from "@/components/ui/Escolha";
import { calendarioCopy as copy } from "@/copy/calendario";
import { track } from "@/lib/analytics";
import { useCalendario } from "@/lib/calendario/useCalendario";
import { mesSeguinte } from "@dominio/calendario.ts";

const CHAVE_MODO = "ninho.calendario.modo";
type Modo = "month" | "agenda";

/** Telas 1 e 2: mês e agenda. Abre sempre no mês atual; "Hoje" volta para ele. */
export default function PaginaCalendario() {
  const { perfil, itens, hoje, dpp, podeCriar } = useCalendario();
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("month");
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoje.slice(5, 7)));

  useEffect(() => {
    let m: Modo = "month";
    try {
      const v = localStorage.getItem(CHAVE_MODO);
      if (v === "month" || v === "agenda") m = v;
    } catch {
      /* nada */
    }
    setModo(m);
    track("cal_viewed", { mode: m });
  }, []);

  if (!perfil) return null;
  const prefixo = `${ano}-${String(mes).padStart(2, "0")}`;
  const marcadosNoMes = itens.filter((i) => i.data.startsWith(prefixo) && i.tipo !== "edd" && i.tipo !== "belly_photo").length;

  function mudarModo(m: Modo) {
    setModo(m);
    track("cal_viewed", { mode: m });
    try {
      localStorage.setItem(CHAVE_MODO, m);
    } catch {
      /* nada */
    }
  }

  function irParaHoje() {
    setAno(Number(hoje.slice(0, 4)));
    setMes(Number(hoje.slice(5, 7)));
    if (modo === "month") router.push(`/calendario/dia?d=${hoje}`);
  }

  return (
    <div>
      <Cabecalho
        titulo={copy.titulo}
        voltarPara="/eu"
        acao={
          podeCriar ? (
            <Link href="/calendario/ajustes" aria-label={copy.ajustes} className="grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave">
              <Settings size={20} />
            </Link>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <div className="flex items-center justify-between gap-2">
          <Escolha
            semRotulo
            rotulo={copy.modo}
            opcoes={[
              { valor: "month", rotulo: copy.mes },
              { valor: "agenda", rotulo: copy.agenda },
            ]}
            valor={modo}
            onMudar={mudarModo}
          />
          <Botao variant="secundario" onClick={irParaHoje}>
            {copy.hoje}
          </Botao>
        </div>

        {modo === "month" ? (
          <>
            <Mes
              ano={ano}
              mes={mes}
              itens={itens}
              hoje={hoje}
              dpp={dpp}
              onMudarMes={(p) => {
                const n = mesSeguinte(ano, mes, p);
                setAno(n.ano);
                setMes(n.mes);
              }}
            />
            {marcadosNoMes === 0 && (
              <Card tom="suave">
                <p className="tipo-corpo text-texto">{copy.vazio}</p>
                {podeCriar && (
                  <Link href="/consultas" className="mt-1 inline-flex min-h-11 items-center text-[15px] font-medium text-primaria-texto">
                    {copy.vazioConsulta}
                  </Link>
                )}
              </Card>
            )}
          </>
        ) : (
          <Agenda itens={itens} hoje={hoje} dpp={dpp} />
        )}

        {podeCriar && (
          <Botao largura="total" tamanho="lg" icone={<Plus size={18} aria-hidden />} onClick={() => router.push("/calendario/evento")}>
            {copy.novo}
          </Botao>
        )}
      </div>
    </div>
  );
}
