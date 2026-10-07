import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { direitosCopy as copy } from "@/copy/direitos";
import type { Eventos } from "@/lib/analytics";
import type { CartaoVisivel } from "@/lib/direitos/useDireitos";

/** Linha de direito: a pergunta, o tema e o começo da resposta. */
export function LinhaDireito({ c, de, acao }: { c: CartaoVisivel; de: Eventos["rights_card_opened"]["source"]; acao?: ReactNode }) {
  return (
    <li className="flex items-center">
      <Link href={`/direitos/cartao?slug=${c.slug}&de=${de}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="tipo-meta block">{copy.temas[c.topic]}</span>
          <span className="block text-[15px] font-medium text-texto">{c.question}</span>
          <span className="tipo-meta line-clamp-2 block">{c.answer}</span>
        </span>
        <ChevronRight size={16} aria-hidden className="shrink-0 text-texto-mudo" />
      </Link>
      {acao}
    </li>
  );
}
