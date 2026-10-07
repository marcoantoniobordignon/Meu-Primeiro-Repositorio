"use client";

import { CloudUpload, Star } from "lucide-react";
import Link from "next/link";

import { Foto } from "@/components/ui/Foto";
import { galeriaCopy as copy } from "@/copy/galeria";
import { useAguardandoEnvio } from "@/lib/arquivos/arquivos";
import type { DocumentPage, MedicalDocument } from "@/lib/dados/colecoes";
import { rotuloDia } from "@/lib/dates";
import { semanaDoDocumento } from "@/lib/galeria/regras";

interface Props {
  doc: MedicalDocument;
  paginas: DocumentPage[];
  dpp: string | null | undefined;
  hoje: string;
  vista: "grade" | "linha";
}

export function tituloDoDocumento(d: MedicalDocument): string {
  return d.title || copy.tipos[d.kind];
}

/** Um documento na galeria: miniatura da 1ª página, tipo, data, semana e o selo "Aguardando envio" (RN-11). */
export function ItemDocumento({ doc, paginas, dpp, hoje, vista }: Props) {
  const aguardando = useAguardandoEnvio(paginas.map((p) => p.storage_path));
  const semana = semanaDoDocumento(dpp, doc.exam_date);
  // Na linha do tempo a semana vai em destaque à direita; na grade, junto da data.
  const meta = [rotuloDia(doc.exam_date, hoje), vista === "grade" && semana !== null ? copy.semana(semana) : null, copy.paginas(paginas.length)].filter(Boolean).join(" · ");
  const selo = aguardando.size > 0 && (
    <span className="inline-flex items-center gap-1 rounded-pilula bg-acento-suave px-2 py-0.5 text-[11px] font-medium text-texto">
      <CloudUpload size={12} aria-hidden />
      {copy.aguardando}
    </span>
  );
  const miniatura = (
    <span className="relative block size-full overflow-hidden bg-fio">
      <Foto caminho={paginas[0]?.storage_path} alt={tituloDoDocumento(doc)} />
      {doc.is_favorite && (
        <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-superficie text-acento" aria-label={copy.favorito}>
          <Star size={13} fill="currentColor" />
        </span>
      )}
    </span>
  );

  if (vista === "grade") {
    return (
      <li>
        <Link href={`/galeria/${doc.id}`} className="block overflow-hidden rounded-card bg-superficie [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
          <span className="block aspect-[3/4]">{miniatura}</span>
          <span className="block px-3 py-2">
            <span className="block truncate text-[14px] font-medium text-texto">{tituloDoDocumento(doc)}</span>
            <span className="tipo-meta block truncate">{meta}</span>
            {selo}
          </span>
        </Link>
      </li>
    );
  }
  return (
    <li>
      <Link href={`/galeria/${doc.id}`} className="flex min-h-16 items-center gap-3 rounded-card bg-superficie p-2 pr-4 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
        <span className="block h-16 w-12 shrink-0 overflow-hidden rounded-[10px]">{miniatura}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-texto">{tituloDoDocumento(doc)}</span>
          <span className="tipo-meta block">{meta}</span>
          {selo}
        </span>
        {semana !== null && <span className="tipo-heroi-rotulo shrink-0 text-primaria-texto">{copy.semana(semana)}</span>}
      </Link>
    </li>
  );
}
