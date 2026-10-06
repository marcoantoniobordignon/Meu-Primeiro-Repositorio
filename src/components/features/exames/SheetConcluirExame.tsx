"use client";

import { FileUp } from "lucide-react";
import { useRef, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { examesCopy as copy } from "@/copy/exames";
import { track } from "@/lib/analytics";
import type { UserExam } from "@/lib/dados/colecoes";
import { ACEITA_DOCUMENTO, anexarDocumento } from "@/lib/documentos";
import { concluirExame } from "@/lib/exames/acoes";
import { exameDoCatalogo, nomeDoExame } from "@dominio/exames.ts";
import { dataNoFuso } from "@dominio/tempo.ts";

interface Props {
  exame: UserExam | null;
  tz: string;
  /** "Já fiz" num exame de janela passada aceita só marcar, sem data (decisão tomada). */
  semData?: boolean;
  onFechar: () => void;
}

/** RN-08: "Anexar resultado agora?" (vincula document_id) ou "Só marcar como feito". */
export function SheetConcluirExame({ exame, tz, semData = false, onFechar }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [anexando, setAnexando] = useState(false);
  const { mostrar } = useToast();

  function concluir(documentId: string | null) {
    if (!exame) return;
    const hoje = dataNoFuso(new Date(), tz);
    const feitoEm = semData ? null : exame.scheduled_at ? dataNoFuso(new Date(exame.scheduled_at), tz) : hoje;
    concluirExame(exame, feitoEm && feitoEm > hoje ? hoje : feitoEm, documentId);
    track("exam_marked_done", { with_document: Boolean(documentId) });
    mostrar(copy.concluido);
    onFechar();
  }

  async function aoEscolher(arquivo: File | undefined) {
    if (!exame || !arquivo) return;
    setAnexando(true);
    try {
      const doc = await anexarDocumento(arquivo, {
        kind: exameDoCatalogo(exame.catalog_code)?.doc_kind ?? "other",
        title: nomeDoExame(exame),
        taken_on: dataNoFuso(new Date(), tz),
      });
      concluir(doc.id);
    } catch {
      mostrar(copy.anexoErro);
    } finally {
      setAnexando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <Sheet aberto={Boolean(exame)} onFechar={onFechar} titulo={copy.anexarPergunta}>
      <p className="tipo-corpo text-texto-mudo">{copy.anexarApoio}</p>
      <input ref={entrada} type="file" accept={ACEITA_DOCUMENTO} className="sr-only" aria-label={copy.anexar} tabIndex={-1} onChange={(e) => void aoEscolher(e.target.files?.[0])} />
      <div className="mt-5 flex flex-col gap-2">
        <Botao largura="total" tamanho="lg" carregando={anexando} icone={<FileUp size={18} aria-hidden />} onClick={() => entrada.current?.click()}>
          {anexando ? copy.anexando : copy.anexar}
        </Botao>
        <Botao largura="total" variant="secundario" disabled={anexando} onClick={() => concluir(null)}>
          {copy.soMarcar}
        </Botao>
      </div>
    </Sheet>
  );
}
