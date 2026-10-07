"use client";

import { Hospital } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Card } from "@/components/ui/Card";
import { planoCopy as copy } from "@/copy/planoParto";
import { useColecao } from "@/lib/dados/colecao";
import { birthPlans } from "@/lib/dados/colecoes";
import { mostrarQualMaternidade } from "@dominio/plano-parto.ts";

/** RN-11: semana 37+ sem "Onde" preenchida → "Qual maternidade?". RN-12: da 34 em diante, o plano já fica em cache. */
export function CardQualMaternidade({ semana }: { semana: number | null }) {
  const plano = useColecao(birthPlans)[0] ?? null;
  const router = useRouter();
  useEffect(() => {
    if (semana !== null && semana >= 34) for (const r of ["/plano-parto", "/plano-parto/listas", "/plano-parto/documentos", "/plano-parto/onde"]) router.prefetch(r);
  }, [semana, router]);
  if (!mostrarQualMaternidade(semana, plano)) return null;
  return (
    <Link href="/plano-parto/onde" className="block">
      <Card tom="acento">
        <div className="flex items-center gap-3">
          <Hospital size={22} aria-hidden className="shrink-0 text-texto" />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-medium text-texto">{copy.qualMaternidade}</span>
            <span className="tipo-meta block">{copy.qualMaternidadeApoio}</span>
          </span>
          <span className="text-[14px] font-medium text-primaria-texto">{copy.qualMaternidadeAcao}</span>
        </div>
      </Card>
    </Link>
  );
}
