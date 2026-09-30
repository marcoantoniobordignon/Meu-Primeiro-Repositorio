"use client";

import { Anel } from "@/components/ui/Anel";
import { bebeCopy as copy } from "@/copy/bebe";
import type { Bebe } from "@/lib/dados/colecoes";
import { idadeCorrigida, idadeDetalhada, paraISO, textoIdade } from "@/lib/dates";

/** BEB-10: anel do primeiro ano com "3 meses e 2 semanas"; prematuro mostra a idade corrigida. */
export function AnelPrimeiroAno({ bebe }: { bebe: Bebe }) {
  const hoje = paraISO(new Date());
  const i = idadeDetalhada(bebe.nascido_em, hoje);
  const corrigida = bebe.prematuro_semanas ? idadeCorrigida(bebe.nascido_em, bebe.prematuro_semanas, hoje) : null;
  const numero = i.meses > 0 ? i.meses : i.semanas > 0 ? i.semanas : i.dias;
  const rotulo = i.meses > 0 ? (i.meses === 1 ? "mês" : "meses") + (i.semanas > 0 ? ` e ${i.semanas === 1 ? "1 semana" : `${i.semanas} semanas`}` : "") : i.semanas > 0 ? (i.semanas === 1 ? "semana" : "semanas") : i.dias === 1 ? "dia" : "dias";

  return (
    <div className="flex flex-col items-center">
      <Anel total={12} atual={i.progressoAno * 12} segmentos={[3, 6, 9]} tamanho={180} rotulo={textoIdade(i)}>
        <div className="text-center">
          <p className="tipo-heroi text-texto">{numero}</p>
          <p className="tipo-heroi-rotulo text-texto-mudo">{rotulo}</p>
        </div>
      </Anel>
      <p className="tipo-meta mt-3">
        {bebe.nome} · {textoIdade(i)} {copy.idade.deVida}
        {corrigida && <> · {copy.idade.corrigida(textoIdade(corrigida))}</>}
      </p>
    </div>
  );
}
