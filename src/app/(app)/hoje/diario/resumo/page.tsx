"use client";

import { Copy } from "lucide-react";
import { useMemo, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { sintomasCopy as copy } from "@/copy/sintomas";
import { track } from "@/lib/analytics";
import { useColecao } from "@/lib/dados/colecao";
import { sintomas as colecao } from "@/lib/dados/colecoes";
import { deISO, paraISO, semanaGestacional, somarDias } from "@/lib/dates";
import { usePerfil } from "@/lib/perfil";
import { resumoComoTexto, resumoPeriodo } from "@/lib/sintomas/regras";

const DIAS = 14;

/** SIN-06: grade dia × sintoma dos últimos 14 dias e "copiar como texto". */
export default function PaginaResumo() {
  const todos = useColecao(colecao);
  const perfil = usePerfil();
  const hoje = paraISO(new Date());
  const { mostrar } = useToast();
  const [semSuporte, setSemSuporte] = useState(false);

  const dias = useMemo(() => Array.from({ length: DIAS }, (_, i) => somarDias(hoje, -(DIAS - 1 - i))), [hoje]);
  const linhas = resumoPeriodo(todos, hoje, DIAS);
  const inicio = dias[0]!;
  const semanaInicio = perfil?.dpp ? semanaGestacional(perfil.dpp, inicio).semana : 0;
  const semanaFim = perfil?.dpp ? semanaGestacional(perfil.dpp, hoje).semana : 0;
  const texto = resumoComoTexto(linhas, semanaInicio, semanaFim);
  const intensidade = (slug: string, data: string) => todos.find((s) => s.slug === slug && s.data === data)?.intensidade ?? 0;

  async function copiar() {
    track("resumo_copiado", { dias: DIAS, sintomas: linhas.length });
    try {
      await navigator.clipboard.writeText(texto);
      mostrar(copy.resumo.copiado);
    } catch {
      setSemSuporte(true);
    }
  }

  return (
    <div>
      <Cabecalho titulo={copy.resumo.titulo} />
      <div className="flex flex-col gap-4 px-5 pt-2">
        <p className="tipo-corpo text-texto-mudo">{copy.resumo.apoio}</p>

        {linhas.length === 0 ? (
          <Card>
            <p className="tipo-corpo text-texto-mudo">{copy.resumo.vazio}</p>
          </Card>
        ) : (
          <Card compacto>
            <div className="scroll-x-sem-barra -mx-4 px-4">
              <table className="border-separate border-spacing-y-1 text-left">
                <thead>
                  <tr>
                    <th className="tipo-meta sticky left-0 bg-superficie pr-3 font-normal">{copy.resumo.dia}</th>
                    {dias.map((d) => (
                      <th key={d} className="tipo-meta w-6 text-center font-normal">
                        {deISO(d).getDate()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.slug}>
                      <th className="sticky left-0 whitespace-nowrap bg-superficie pr-3 text-[13px] font-medium text-texto">{l.nome}</th>
                      {dias.map((d) => {
                        const i = intensidade(l.slug, d);
                        return (
                          <td key={d} className="text-center">
                            <span
                              aria-label={i ? copy.diario.intensidade[i as 1 | 2 | 3] : undefined}
                              className={`inline-block size-3.5 rounded-full ${i === 0 ? "bg-fio" : i === 1 ? "bg-acento/40" : i === 2 ? "bg-acento/70" : "bg-acento"}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card tom="suave">
          <p className="tipo-corpo select-all text-primaria-texto">{texto}</p>
          {semSuporte && <p className="tipo-meta mt-2">{copy.resumo.semSuporte}</p>}
        </Card>

        <Botao largura="total" tamanho="lg" icone={<Copy size={18} aria-hidden />} onClick={copiar} disabled={linhas.length === 0}>
          {copy.resumo.copiar}
        </Botao>
      </div>
    </div>
  );
}
