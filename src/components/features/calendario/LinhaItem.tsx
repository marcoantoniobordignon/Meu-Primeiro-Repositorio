"use client";

import { Check, ChevronRight, Download } from "lucide-react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/Toast";
import { calendarioCopy as copy } from "@/copy/calendario";
import { track } from "@/lib/analytics";
import { baixarIcs } from "@/lib/calendario/acoes";
import { formatarHora } from "@/lib/dates";
import type { ItemCalendario } from "@dominio/calendario.ts";

import { FUNDO_DA_COR } from "./cores";

const EXPORTAVEIS = new Set(["appointment", "exam", "custom", "edd"]);

/** Um item do dia: cor do tipo, hora, abre a origem (RN-03) e "Adicionar ao meu calendário" (RN-09). */
export function LinhaItem({ item }: { item: ItemCalendario }) {
  const router = useRouter();
  const { mostrar } = useToast();
  // Resumo de medicamentos, foto e DPP já dizem o que são no título.
  const deAgenda = item.tipo === "appointment" || item.tipo === "exam" || item.tipo === "custom";
  const quando = !deAgenda ? null : item.diaInteiro ? copy.diaInteiro : item.inicio ? formatarHora(item.inicio) : null;
  const apoio = [deAgenda ? copy.tipos[item.tipo] : null, quando, item.local, item.detalhe].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        aria-label={copy.abrir(item.titulo)}
        onClick={() => {
          track("cal_item_opened", { item_type: item.tipo });
          router.push(item.link);
        }}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-card px-2 text-left active:bg-primaria-suave"
      >
        <span aria-hidden className={`size-3 shrink-0 rounded-full ${FUNDO_DA_COR[item.cor]}`} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[15px] font-medium text-texto">
            <span className="truncate">{item.titulo}</span>
            {item.feito && <Check size={14} aria-label={copy.feito} className="shrink-0 text-sucesso" />}
          </span>
          {apoio && <span className="tipo-meta block truncate">{apoio}</span>}
        </span>
        <ChevronRight size={16} aria-hidden className="shrink-0 text-texto-mudo" />
      </button>
      {EXPORTAVEIS.has(item.tipo) && (
        <button
          type="button"
          aria-label={copy.exportar(item.titulo)}
          onClick={() => {
            if (baixarIcs(item)) {
              track("cal_item_exported", {});
              mostrar(copy.exportado);
            }
          }}
          className="grid size-11 shrink-0 place-items-center rounded-pilula text-primaria-texto active:bg-primaria-suave"
        >
          <Download size={18} />
        </button>
      )}
    </li>
  );
}
