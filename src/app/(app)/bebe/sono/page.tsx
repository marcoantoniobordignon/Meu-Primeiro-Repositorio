"use client";

import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { bebeCopy as copy } from "@/copy/bebe";
import { track } from "@/lib/analytics";
import { doBebe } from "@/lib/bebe/registros";
import { preverSoneca, resumoSono7Dias } from "@/lib/bebe/soneca";
import { useBebes } from "@/lib/bebe/useBebes";
import { useColecao } from "@/lib/dados/colecao";
import { bebes as colecaoBebes, registrosBebe } from "@/lib/dados/colecoes";
import { deISO, formatarMinutos } from "@/lib/dates";
import { useAgora } from "@/lib/hooks/useAgora";

/** Spec 10: últimos 7 dias em barras (soneca e noite) e a janela de vigília provável. */
export default function PaginaSono() {
  const { ativo } = useBebes();
  const todos = useColecao(registrosBebe);
  const agora = useAgora(60_000);
  if (!ativo) return null;

  const sonos = doBebe(todos, ativo.id).filter((r) => r.tipo === "sono");
  const dias = resumoSono7Dias(sonos, agora);
  const maximo = Math.max(60, ...dias.map((d) => d.sonecaMin + d.noiteMin));
  const p = preverSoneca(sonos, ativo, agora);
  const temDados = dias.some((d) => d.sonecaMin + d.noiteMin > 0);

  function alternarAviso() {
    const ligado = !ativo!.aviso_soneca;
    colecaoBebes.salvar({ ...ativo!, aviso_soneca: ligado });
    track("previsao_aviso_ligado", { ligado });
  }

  return (
    <div>
      <Cabecalho titulo={copy.soneca.telaTitulo} voltarPara="/bebe" />
      <div className="flex flex-col gap-4 px-5 pt-1">
        <Card>
          <p className="tipo-titulo-secao text-texto-mudo">{copy.soneca.ultimos7}</p>
          {temDados ? (
            <>
              <div className="mt-3 flex gap-2" role="img" aria-label={copy.soneca.ultimos7}>
                {dias.map((d) => (
                  <div key={d.dia} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-32 w-full flex-col justify-end overflow-hidden rounded-pilula bg-fio/60">
                      <div className="w-full bg-sono/45" style={{ height: `${(d.noiteMin / maximo) * 100}%` }} title={`noite ${formatarMinutos(d.noiteMin)}`} />
                      <div className="w-full bg-sono" style={{ height: `${(d.sonecaMin / maximo) * 100}%` }} title={`sonecas ${formatarMinutos(d.sonecaMin)}`} />
                    </div>
                    <span className="tipo-meta text-[10px]">{deISO(d.dia).toLocaleDateString("pt-BR", { weekday: "narrow" })}</span>
                  </div>
                ))}
              </div>
              <div className="tipo-meta mt-2 flex gap-4">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-full bg-sono" /> {copy.soneca.sonecaLegenda}
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-full bg-sono/45" /> {copy.soneca.noiteLegenda}
                </span>
              </div>
            </>
          ) : (
            <p className="tipo-corpo mt-2 text-texto-mudo">{copy.soneca.semRegistros}</p>
          )}
        </Card>

        {p.vigiliaMin && (
          <Card tom="suave">
            <p className="tipo-corpo text-primaria-texto">
              {copy.soneca.vigiliaMedia(formatarMinutos(p.vigiliaMin))} · {p.base === "mediana" ? copy.soneca.baseMediana : copy.soneca.baseTabela}
            </p>
          </Card>
        )}

        <Card>
          <label className="flex items-center gap-3">
            <span className="flex-1">
              <span className="block text-[15px] font-medium text-texto">{copy.soneca.aviso}</span>
              <span className="tipo-meta block">{copy.soneca.avisoApoio}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={ativo.aviso_soneca}
              aria-label={copy.soneca.aviso}
              onClick={alternarAviso}
              className={`relative h-7 w-12 shrink-0 rounded-pilula p-0 transition-colors ${ativo.aviso_soneca ? "bg-primaria" : "bg-fio"}`}
            >
              <span aria-hidden className={`absolute left-0 top-1 size-5 rounded-full bg-superficie transition-transform ${ativo.aviso_soneca ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </label>
        </Card>
      </div>
    </div>
  );
}
