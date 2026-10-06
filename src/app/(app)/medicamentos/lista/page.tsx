"use client";

import { ChevronRight, Pill, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SheetPaywall } from "@/components/features/paywall/SheetPaywall";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Vazio } from "@/components/ui/Vazio";
import { medicamentosCopy as copy } from "@/copy/medicamentos";
import { useColecao } from "@/lib/dados/colecao";
import { medications, type Medication } from "@/lib/dados/colecoes";
import { descreverAgenda, podeAtivarMais } from "@/lib/medicamentos/regras";
import { temPlano, usePerfil } from "@/lib/perfil";

/** Meus medicamentos: ativos e arquivados. O 4º ativo no free abre o paywall (RN-11). */
export default function PaginaListaMedicamentos() {
  const todos = useColecao(medications);
  const perfil = usePerfil();
  const router = useRouter();
  const [paywall, setPaywall] = useState(false);
  const ativos = todos.filter((m) => m.is_active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const arquivados = todos.filter((m) => !m.is_active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  function adicionar() {
    if (!podeAtivarMais(todos, temPlano(perfil))) setPaywall(true);
    else router.push("/medicamentos/novo");
  }

  const linha = (m: Medication) => (
    <li key={m.id}>
      <Link href={`/medicamentos/${m.id}`} className="flex min-h-14 items-center gap-3 rounded-card bg-superficie px-4 py-3 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
        <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full ${m.color_key === "acento" ? "bg-acento-suave text-texto" : "bg-primaria-suave text-primaria-texto"}`}>
          <Pill size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-texto">{m.name}</span>
          <span className="tipo-meta block truncate">
            {[m.dose, descreverAgenda(m), m.schedule_type !== "as_needed" && !m.reminders_on ? copy.lembreteDesligado : null].filter(Boolean).join(" · ")}
          </span>
        </span>
        <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
      </Link>
    </li>
  );

  return (
    <div>
      <Cabecalho titulo={copy.meus} voltarPara="/medicamentos" />
      {todos.length === 0 ? (
        <Vazio icone={<Pill size={24} />} frase={copy.vazio} acao={<Botao onClick={adicionar}>{copy.cadastrar}</Botao>} />
      ) : (
        <div className="flex flex-col gap-5 px-5 pt-1">
          <section>
            <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.ativos}</h2>
            <ul className="flex flex-col gap-2">{ativos.map(linha)}</ul>
          </section>
          {arquivados.length > 0 && (
            <section>
              <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.arquivados}</h2>
              <ul className="flex flex-col gap-2">{arquivados.map(linha)}</ul>
            </section>
          )}
          <Botao largura="total" variant="secundario" icone={<Plus size={16} aria-hidden />} onClick={adicionar}>
            {copy.adicionar}
          </Botao>
        </div>
      )}
      <SheetPaywall aberto={paywall} gatilho={{ feature: "medications", trigger: "active_limit" }} onFechar={() => setPaywall(false)} />
    </div>
  );
}
