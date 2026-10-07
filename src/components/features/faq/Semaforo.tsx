import { faqCopy as copy } from "@/copy/faq";
import type { Veredito } from "@dominio/faq.ts";

const COR: Record<Veredito, string> = { safe: "bg-sucesso", caution: "bg-fralda", avoid: "bg-erro" };

/** Semáforo com cor e palavra (a cor nunca é a única pista). */
export function Semaforo({ veredito, grande = false }: { veredito: Veredito; grande?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-pilula border border-fio bg-superficie font-medium text-texto ${grande ? "px-3 py-1 text-[15px]" : "px-2 py-0.5 text-[12px]"}`}>
      <span aria-hidden className={`rounded-full ${COR[veredito]} ${grande ? "size-3" : "size-2"}`} />
      {copy.veredito[veredito]}
    </span>
  );
}
