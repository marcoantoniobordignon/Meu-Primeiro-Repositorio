import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { feCopy as copy } from "@/copy/fe";
import type { OracaoVisivel } from "@/lib/fe/useFe";
import { diaDoSanto } from "@dominio/fe.ts";

/** Linha de oração: título e, nos intercessores, o dia da festa. */
export function LinhaOracao({ o }: { o: OracaoVisivel }) {
  const dia = diaDoSanto(o.saint_day);
  return (
    <li>
      <Link href={`/fe/oracao?slug=${o.slug}`} className="flex min-h-14 items-center gap-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-texto">{o.title}</span>
          {dia && <span className="tipo-meta block">{copy.diaDoSanto(dia)}</span>}
        </span>
        <ChevronRight size={16} aria-hidden className="shrink-0 text-texto-mudo" />
      </Link>
    </li>
  );
}
