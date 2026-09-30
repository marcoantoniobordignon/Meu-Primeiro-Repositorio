"use client";

import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { consultasCopy as copy } from "@/copy/consultas";
import { track } from "@/lib/analytics";
import { tiposConsulta } from "@/lib/consultas";
import { novoId } from "@/lib/dados/colecao";
import { consultas, type Consulta } from "@/lib/dados/colecoes";
import { paraISO } from "@/lib/dates";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  consulta?: Consulta | null;
}

function partes(iso?: string): { data: string; hora: string } {
  if (!iso) return { data: "", hora: "" };
  const d = new Date(iso);
  return { data: paraISO(d), hora: d.toTimeString().slice(0, 5) };
}

/** Sheet "Nova consulta": data, hora, tipo, profissional, local. */
export function SheetConsulta({ aberto, onFechar, consulta }: Props) {
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [tipo, setTipo] = useState<Consulta["tipo"]>("pre_natal");
  const [profissional, setProfissional] = useState("");
  const [local, setLocal] = useState("");
  const [notas, setNotas] = useState("");
  const [tocou, setTocou] = useState(false);
  const { mostrar } = useToast();

  useEffect(() => {
    if (!aberto) return;
    const p = partes(consulta?.data);
    setData(p.data);
    setHora(p.hora || "09:00");
    setTipo(consulta?.tipo ?? "pre_natal");
    setProfissional(consulta?.profissional ?? "");
    setLocal(consulta?.local ?? "");
    setNotas(consulta?.notas ?? "");
    setTocou(false);
  }, [aberto, consulta]);

  const valido = Boolean(data && hora);

  function salvar() {
    setTocou(true);
    if (!valido) return;
    const [a, m, d] = data.split("-").map(Number);
    const [h, min] = hora.split(":").map(Number);
    const quando = new Date(a!, m! - 1, d!, h, min).toISOString();
    consultas.salvar({
      id: consulta?.id ?? novoId(),
      data: quando,
      tipo,
      profissional: profissional.trim() || null,
      local: local.trim() || null,
      notas: notas.trim() || null,
      realizada: consulta?.realizada ?? false,
    });
    if (!consulta) track("consulta_criada", { tipo });
    mostrar(copy.salva);
    onFechar();
  }

  function apagar() {
    if (consulta) consultas.apagar(consulta.id);
    mostrar(copy.apagada);
    onFechar();
  }

  return (
    <Sheet
      aberto={aberto}
      onFechar={onFechar}
      titulo={consulta ? copy.editar : copy.nova}
      rodape={
        <div className="flex flex-col gap-2">
          <Botao largura="total" tamanho="lg" onClick={salvar} disabled={tocou && !valido}>
            {copy.salvar}
          </Botao>
          {consulta && (
            <Botao largura="total" variant="fantasma" onClick={apagar}>
              {copy.apagar}
            </Botao>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <CampoTexto rotulo={copy.data} type="date" value={data} onChange={(e) => setData(e.target.value)} erro={tocou && !data ? copy.erroData : undefined} />
          <CampoTexto rotulo={copy.hora} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>

        <div>
          <span className="tipo-titulo-secao mb-1.5 block text-texto-mudo">{copy.tipo}</span>
          <div role="radiogroup" aria-label={copy.tipo} className="flex flex-wrap gap-2">
            {(Object.keys(tiposConsulta) as Consulta["tipo"][]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tipo === t}
                onClick={() => setTipo(t)}
                className={`min-h-11 rounded-pilula border px-4 text-[14px] font-medium ${
                  tipo === t ? "border-acento bg-acento-suave text-texto" : "border-fio bg-superficie text-texto"
                }`}
              >
                {tiposConsulta[t]}
              </button>
            ))}
          </div>
        </div>

        <CampoTexto rotulo={copy.profissional} value={profissional} onChange={(e) => setProfissional(e.target.value)} autoComplete="off" />
        <CampoTexto rotulo={copy.local} value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />
        {consulta && (
          <label className="block">
            <span className="tipo-titulo-secao mb-1.5 block text-texto-mudo">{copy.notas}</span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="block w-full resize-none rounded-card border border-fio bg-superficie px-4 py-3 text-[16px] text-texto focus:outline-none focus:ring-2 focus:ring-primaria"
            />
          </label>
        )}
      </div>
    </Sheet>
  );
}
