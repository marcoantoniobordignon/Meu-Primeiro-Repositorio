"use client";

import { Anel } from "@/components/ui/Anel";
import { home as copy } from "@/copy/home";
import { legendaSemana, semanaExibida, SEMANAS_GESTACAO, type SemanaGestacional } from "@/lib/dates";

/** HG-01/02/03: anel de 40 semanas com trimestres; cheio depois da 40. */
export function AnelSemana({ g }: { g: SemanaGestacional }) {
  const semana = semanaExibida(g.semana);
  const legenda = legendaSemana(g);
  const atual = g.diasParaDpp < 0 ? SEMANAS_GESTACAO : g.semana + g.dia / 7;

  return (
    <div className="flex flex-col items-center">
      <Anel total={SEMANAS_GESTACAO} atual={atual} segmentos={[13, 27]} rotulo={`${semana} ${copy.semanas}`}>
        <div className="text-center">
          <p className="tipo-heroi text-texto">{semana}</p>
          <p className="tipo-heroi-rotulo text-texto-mudo">
            {semana === 1 ? copy.semana : copy.semanas}
            {g.dia > 0 && g.diasParaDpp >= 0 && <> {copy.eDias(g.dia)}</>}
          </p>
        </div>
      </Anel>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-pilula bg-primaria-suave px-3 py-1 text-[12px] font-medium text-primaria-texto">{copy.trimestre(g.trimestre)}</span>
        <span className={`tipo-corpo ${legenda.tom === "acento" ? "font-medium text-acento" : "text-texto-mudo"}`}>{legenda.texto}</span>
      </div>
    </div>
  );
}
