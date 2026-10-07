"use client";

import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";

import { Botao } from "@/components/ui/Botao";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { examesCopy as copy } from "@/copy/exames";
import { track } from "@/lib/analytics";
import type { UserExam } from "@/lib/dados/colecoes";
import { concluirExame } from "@/lib/exames/acoes";
import { tipoDoExame } from "@dominio/galeria.ts";
import { dataNoFuso } from "@dominio/tempo.ts";

interface Props {
  exame: UserExam | null;
  tz: string;
  /** "Já fiz" num exame de janela passada aceita só marcar, sem data (decisão tomada). */
  semData?: boolean;
  onFechar: () => void;
}

/**
 * RN-08: "Anexar resultado agora?" abre o Adicionar da galeria (funcionalidade 01) com o exame
 * vinculado; salvar lá marca o exame como feito. Ou "Só marcar como feito".
 */
export function SheetConcluirExame({ exame, tz, semData = false, onFechar }: Props) {
  const router = useRouter();
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

  function anexar() {
    if (!exame) return;
    const tipo = tipoDoExame(exame.catalog_code) ?? "other";
    onFechar();
    router.push(`/galeria/adicionar?exame=${exame.id}&tipo=${tipo}`);
  }

  return (
    <Sheet aberto={Boolean(exame)} onFechar={onFechar} titulo={copy.anexarPergunta}>
      <p className="tipo-corpo text-texto-mudo">{copy.anexarApoio}</p>
      <div className="mt-5 flex flex-col gap-2">
        <Botao largura="total" tamanho="lg" icone={<FileUp size={18} aria-hidden />} onClick={anexar}>
          {copy.anexar}
        </Botao>
        <Botao largura="total" variant="secundario" onClick={() => concluir(null)}>
          {copy.soMarcar}
        </Botao>
      </div>
    </Sheet>
  );
}
