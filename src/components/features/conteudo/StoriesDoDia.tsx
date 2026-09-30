"use client";

import { Story } from "@/components/ui/Story";
import { conteudoCopy as copy } from "@/copy/conteudo";
import { useColecao } from "@/lib/dados/colecao";
import { conteudosLidos } from "@/lib/dados/colecoes";
import { paraISO } from "@/lib/dates";
import { storiesDoDia } from "@/lib/conteudo/stories";

interface Props {
  semana?: number;
  mesBebe?: number;
}

/** CON-01..04: carrossel dos 3 stories do dia; lidas ficam esmaecidas. */
export function StoriesDoDia({ semana, mesBebe }: Props) {
  const lidos = useColecao(conteudosLidos);
  const hoje = paraISO(new Date());
  const stories = storiesDoDia(lidos, { hoje, semana, mesBebe });
  if (stories.length === 0) return null;

  return (
    <section>
      <h2 className="tipo-titulo-secao mb-3 text-texto">{copy.storiesTitulo}</h2>
      <div className="scroll-x-sem-barra -mx-5 flex gap-3 px-5">
        {stories.map((s, i) => (
          <Story
            key={s.conteudo.id}
            href={`/hoje/story/${s.conteudo.id}?p=${i}`}
            titulo={s.conteudo.titulo}
            meta={copy.meta(s.conteudo.minutos_leitura)}
            cor={s.conteudo.cor_token}
            lida={s.lida}
            guardada={s.guardada}
          />
        ))}
      </div>
    </section>
  );
}
