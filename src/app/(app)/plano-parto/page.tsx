"use client";

import { Check, ChevronRight, FileDown, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AberturaPorLembrete } from "@/components/features/plano/AberturaPorLembrete";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { planoCopy as copy } from "@/copy/planoParto";
import { track } from "@/lib/analytics";
import { usePlano } from "@/lib/plano/usePlano";
import { ETAPAS, linkTel, NOME_ETAPA, progressoDoPlano } from "@dominio/plano-parto.ts";

const ROTA: Record<(typeof NOME_ETAPA)[keyof typeof NOME_ETAPA], string> = { onde: "/plano-parto/onde", como: "/plano-parto/como", quem: "/plano-parto/quem", documentos: "/plano-parto/documentos", malas: "/plano-parto/listas" };

/** Tela 1 "Plano": progresso, as 5 etapas, "Gerar PDF" e "Ligar para a maternidade" (RN-08). */
export default function PaginaPlano() {
  const { perfil, plano, ver } = usePlano();
  const router = useRouter();
  if (!perfil) return null;
  if (!ver || !plano) return <Cabecalho titulo={copy.titulo} voltarPara="/eu" />;
  const { feitas } = progressoDoPlano(plano.completed_steps);
  const tel = linkTel(plano.maternity_phone);
  return (
    <div>
      <AberturaPorLembrete />
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <div>
          <p className="tipo-corpo text-texto" aria-live="polite">
            {copy.progresso(feitas)}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-pilula bg-fio" aria-hidden>
            <div className="h-full rounded-pilula bg-primaria transition-[width]" style={{ width: `${(feitas / 5) * 100}%` }} />
          </div>
        </div>
        {tel && (
          // RN-08: link `tel:` de verdade (o discador abre com o número), no estilo do botão secundário.
          <a href={tel} onClick={() => track("bp_call_maternity_tapped", {})} className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-pilula bg-primaria-suave px-6 text-[16px] font-medium text-primaria-texto active:brightness-92">
            <Phone size={18} aria-hidden />
            {copy.ligar}
          </a>
        )}
        <ul className="flex flex-col gap-2">
          {ETAPAS.map((n) => {
            const nome = NOME_ETAPA[n];
            const feita = plano.completed_steps.includes(n);
            return (
              <li key={n}>
                <Link href={ROTA[nome]} className="block">
                  <Card>
                    <div className="flex items-center gap-3">
                      <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-medium ${feita ? "bg-sucesso text-superficie" : "bg-primaria-suave text-primaria-texto"}`}>
                        {feita ? <Check size={16} /> : n}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-medium text-texto">
                          {copy.etapas[nome].titulo}
                          {feita && <span className="sr-only"> · {copy.concluida}</span>}
                        </span>
                        <span className="tipo-meta block">{copy.etapas[nome].apoio}</span>
                      </span>
                      <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
        <Botao largura="total" tamanho="lg" variant="secundario" icone={<FileDown size={18} aria-hidden />} onClick={() => router.push("/plano-parto/pdf")}>
          {copy.gerarPdf}
        </Botao>
      </div>
    </div>
  );
}
