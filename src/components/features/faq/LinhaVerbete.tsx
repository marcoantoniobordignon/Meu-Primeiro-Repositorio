import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { VerbeteVisivel } from "@/lib/faq/useFaq";

import { Semaforo } from "./Semaforo";

export function LinhaVerbete({ v }: { v: VerbeteVisivel }) {
  return (
    <li>
      <Link href={`/faq/verbete?slug=${v.slug}`} className="flex min-h-14 items-center gap-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-texto">{v.name}</span>
          <span className="tipo-meta block truncate">{v.short_answer}</span>
        </span>
        <Semaforo veredito={v.verdict} />
        <ChevronRight size={16} aria-hidden className="shrink-0 text-texto-mudo" />
      </Link>
    </li>
  );
}
