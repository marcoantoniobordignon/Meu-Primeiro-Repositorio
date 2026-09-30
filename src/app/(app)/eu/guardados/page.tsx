"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Story } from "@/components/ui/Story";
import { Vazio } from "@/components/ui/Vazio";
import { conteudoCopy as copy } from "@/copy/conteudo";
import { useColecao } from "@/lib/dados/colecao";
import { conteudosLidos } from "@/lib/dados/colecoes";
import { guardadas } from "@/lib/conteudo/stories";

/** CON-03: guardadas continuam acessíveis depois de expirar do carrossel. */
export default function PaginaGuardados() {
  const lidos = useColecao(conteudosLidos);
  const lista = guardadas(lidos);

  return (
    <div>
      <Cabecalho titulo={copy.guardados.titulo} voltarPara="/eu" />
      {lista.length === 0 ? (
        <Vazio
          icone={<Bookmark size={24} />}
          frase={copy.guardados.vazio}
          acao={
            <Link href="/hoje">
              <Botao variant="secundario">{copy.guardados.ir}</Botao>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-3 px-5 pt-2">
          {lista.map((c) => (
            <Story key={c.id} href={`/hoje/story/${c.id}`} titulo={c.titulo} meta={copy.metaGuardada(c.minutos_leitura)} cor={c.cor_token} guardada />
          ))}
        </div>
      )}
    </div>
  );
}
