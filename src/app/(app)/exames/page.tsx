"use client";

import { FlaskConical, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";

import { CardExameOntem } from "@/components/features/exames/CardExameOntem";
import { LinhaExame } from "@/components/features/exames/LinhaExame";
import { SheetConcluirExame } from "@/components/features/exames/SheetConcluirExame";
import { SheetMarcarExame } from "@/components/features/exames/SheetMarcarExame";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { Vazio } from "@/components/ui/Vazio";
import { examesCopy as copy } from "@/copy/exames";
import { track } from "@/lib/analytics";
import { useColecao } from "@/lib/dados/colecao";
import { userExams, type UserExam } from "@/lib/dados/colecoes";
import { restaurarExame } from "@/lib/exames/acoes";
import { agruparPorSecao, ORDEM_SECOES, type Secao } from "@/lib/exames/regras";
import { useAgora } from "@/lib/hooks/useAgora";
import { useFuso } from "@/lib/hooks/useFuso";
import { useAberturaPorLembrete } from "@/lib/lembretes/abertura";
import { dataNoFuso } from "@dominio/tempo.ts";

function Abertura() {
  useAberturaPorLembrete();
  return null;
}

/** "Meus exames": Agora, Próximos, Marcados, Feitos, Anteriores, Dispensados (RN-12: texto fixo de referência). */
export default function PaginaExames() {
  const exames = useColecao(userExams);
  const tz = useFuso();
  const agora = useAgora(60_000);
  const router = useRouter();
  const { mostrar } = useToast();
  const [marcando, setMarcando] = useState<UserExam | null>(null);
  const [concluindo, setConcluindo] = useState<{ exame: UserExam; semData: boolean } | null>(null);
  const grupos = agruparPorSecao(exames, dataNoFuso(agora, tz));

  const acaoDa = (secao: Secao, e: UserExam) => {
    switch (secao) {
      case "agora":
      case "proximos":
        return (
          <Botao variant="secundario" onClick={() => setMarcando(e)}>
            {copy.marcar}
          </Botao>
        );
      case "anteriores":
        return (
          <Botao variant="secundario" onClick={() => setConcluindo({ exame: e, semData: true })}>
            {copy.jaFiz}
          </Botao>
        );
      case "dispensados":
        return (
          <Botao
            variant="fantasma"
            onClick={() => {
              restaurarExame(e);
              track("exam_restored", {});
              mostrar(copy.restaurado);
            }}
          >
            {copy.restaurar}
          </Botao>
        );
      default:
        return undefined;
    }
  };

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
      <Suspense>
        <Abertura />
      </Suspense>
      {exames.length === 0 ? (
        <Vazio icone={<FlaskConical size={24} />} frase={copy.vazio} />
      ) : (
        <div className="flex flex-col gap-5 px-5 pt-1">
          <Card tom="suave">
            <p className="tipo-corpo text-primaria-texto">{copy.referencia}</p>
          </Card>
          <CardExameOntem />
          {ORDEM_SECOES.filter((s) => grupos[s].length > 0).map((s) => (
            <section key={s} aria-labelledby={`secao-${s}`}>
              <h2 id={`secao-${s}`} className="tipo-titulo-secao mb-1 text-texto">
                {copy.secoes[s]}
              </h2>
              {(s === "agora" || s === "anteriores") && <p className="tipo-meta mb-2">{copy.apoioSecao[s]}</p>}
              <ul className="flex flex-col gap-2">
                {grupos[s].map((e) => (
                  <LinhaExame key={e.id} exame={e} acao={acaoDa(s, e)} />
                ))}
              </ul>
            </section>
          ))}
          <Botao largura="total" variant="secundario" icone={<Plus size={16} aria-hidden />} onClick={() => router.push("/exames/adicionar")}>
            {copy.adicionar}
          </Botao>
        </div>
      )}
      <SheetMarcarExame exame={marcando} tz={tz} onFechar={() => setMarcando(null)} />
      <SheetConcluirExame exame={concluindo?.exame ?? null} semData={concluindo?.semData} tz={tz} onFechar={() => setConcluindo(null)} />
    </div>
  );
}
