import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";

import { artigosCopy as copy } from "@/copy/artigos";
import type { Eventos } from "@/lib/analytics";
import type { ArtigoVisivel } from "@/lib/artigos/useArtigos";

/** Linha de artigo: semana, título, resumo, tempo de leitura e "Lido". O toque leva a origem para o evento. */
export function LinhaArtigo({ a, lido, de }: { a: ArtigoVisivel; lido: boolean; de: Eventos["article_opened"]["source"] }) {
  return (
    <li>
      <Link href={`/artigos/ler?slug=${a.slug}&de=${de}`} className="flex min-h-16 items-center gap-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="tipo-meta block">{copy.semanas(a.week_from, a.week_to)} · {copy.minutos(a.reading_minutes)}</span>
          <span className="block text-[15px] font-medium text-texto">{a.title}</span>
          <span className="tipo-meta line-clamp-2 block">{a.summary}</span>
        </span>
        {lido ? (
          <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-texto-mudo">
            <Check size={14} aria-hidden className="text-sucesso" />
            {copy.lido}
          </span>
        ) : (
          <ChevronRight size={16} aria-hidden className="shrink-0 text-texto-mudo" />
        )}
      </Link>
    </li>
  );
}
