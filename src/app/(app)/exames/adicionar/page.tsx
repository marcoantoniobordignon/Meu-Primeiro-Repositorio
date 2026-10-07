"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { examesCopy as copy } from "@/copy/exames";
import { track } from "@/lib/analytics";
import { useColecao } from "@/lib/dados/colecao";
import { userExams } from "@/lib/dados/colecoes";
import { adicionarDoCatalogo, criarPersonalizado } from "@/lib/exames/acoes";
import { extrasDisponiveis, janelaPersonalizadaValida, nomePersonalizadoValido } from "@/lib/exames/regras";
import { useContextoExames } from "@/lib/exames/useExames";

function semanaOuNulo(v: string): number | null {
  return v.trim() === "" ? null : Number(v);
}

/** "Outros exames comuns" e "Criar o meu" (RN-09: nome obrigatório, janela opcional em semanas). */
export default function PaginaAdicionarExame() {
  const exames = useColecao(userExams);
  const ctx = useContextoExames();
  const router = useRouter();
  const { mostrar } = useToast();
  const [nome, setNome] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [tocou, setTocou] = useState(false);
  const extras = extrasDisponiveis(exames);
  const nomeOk = nomePersonalizadoValido(nome);
  const semanasOk = janelaPersonalizadaValida(semanaOuNulo(inicio), semanaOuNulo(fim));

  function criar() {
    setTocou(true);
    if (!ctx || !nomeOk || !semanasOk) return;
    criarPersonalizado(nome, { inicio: semanaOuNulo(inicio), fim: semanaOuNulo(fim) }, ctx);
    track("exam_custom_added", {});
    mostrar(copy.criado);
    router.push("/exames");
  }

  return (
    <div>
      <Cabecalho titulo={copy.adicionar} voltarPara="/exames" />
      <div className="flex flex-col gap-5 px-5 pt-1">
        {extras.length > 0 && ctx && (
          <section>
            <h2 className="tipo-titulo-secao mb-2 text-texto">{copy.outros}</h2>
            <ul className="flex flex-col gap-2">
              {extras.map((c) => (
                <li key={c.code} className="flex items-center gap-3 rounded-card bg-superficie px-4 py-3 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-texto">{c.name}</span>
                    <span className="tipo-meta block">{c.short_desc}</span>
                  </span>
                  <Botao
                    variant="secundario"
                    onClick={() => {
                      adicionarDoCatalogo(c.code, ctx);
                      track("exam_extra_added", { code: c.code });
                      mostrar(copy.criado);
                    }}
                  >
                    {copy.adicionar.split(" ")[0]}
                  </Botao>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="tipo-titulo-secao mb-2 text-texto">{copy.criarMeu}</h2>
          <Card>
            <div className="flex flex-col gap-4">
              <CampoTexto rotulo={copy.nomeMeu} value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} erro={tocou && !nomeOk ? copy.nomeErro : undefined} autoComplete="off" />
              <div className="grid grid-cols-2 gap-3">
                <CampoTexto rotulo={copy.semanaInicio} type="number" inputMode="numeric" min={4} max={42} value={inicio} onChange={(e) => setInicio(e.target.value)} />
                <CampoTexto rotulo={copy.semanaFim} type="number" inputMode="numeric" min={4} max={42} value={fim} onChange={(e) => setFim(e.target.value)} erro={tocou && !semanasOk ? copy.semanasErro : undefined} />
              </div>
              <Botao largura="total" onClick={criar} disabled={!ctx}>
                {copy.criar}
              </Botao>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
