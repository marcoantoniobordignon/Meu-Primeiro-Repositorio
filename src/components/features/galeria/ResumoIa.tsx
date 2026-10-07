import { galeriaCopy as copy } from "@/copy/galeria";
import type { ResumoLaudo } from "@dominio/galeria.ts";

/**
 * RN-06: só o que está escrito no laudo. Nenhum "alto/baixo" calculado: o destaque aparece apenas
 * quando o próprio laudo marca o valor. O aviso fixo vem sempre logo abaixo.
 */
export function ResumoIa({ resumo }: { resumo: ResumoLaudo }) {
  return (
    <section aria-labelledby="resumo-ia" className="flex flex-col gap-2">
      <h2 id="resumo-ia" className="tipo-titulo-secao text-texto-mudo">
        {copy.resumo}
      </h2>
      {(resumo.exam_name || resumo.lab) && (
        <p className="tipo-corpo text-texto">
          {resumo.exam_name}
          {resumo.exam_name && resumo.lab ? " · " : ""}
          {resumo.lab && copy.laboratorio(resumo.lab)}
        </p>
      )}
      <ul className="flex flex-col divide-y divide-fio">
        {resumo.items.map((item, i) => (
          <li key={i} className="py-2">
            <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] text-texto">
              <span className="font-medium">{item.name}</span>
              <span>
                {item.value}
                {item.unit ? ` ${item.unit}` : ""}
              </span>
              {item.flagged_in_report && <span className="rounded-pilula bg-acento-suave px-2 text-[11px] font-medium text-texto">{copy.marcadoNoLaudo}</span>}
            </p>
            {item.reference && <p className="tipo-meta">{copy.referencia(item.reference)}</p>}
          </li>
        ))}
      </ul>
      <p className="tipo-meta border-t border-fio pt-2" data-testid="aviso-ia">
        {copy.avisoIa}
      </p>
    </section>
  );
}
