"use client";

import { BarChart3, Check, ListChecks, Pill, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { SheetDose } from "@/components/features/medicamentos/SheetDose";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Escolha } from "@/components/ui/Escolha";
import { useToast } from "@/components/ui/Toast";
import { Vazio } from "@/components/ui/Vazio";
import { medicamentosCopy as copy } from "@/copy/medicamentos";
import { track } from "@/lib/analytics";
import { compartilharTexto } from "@/lib/compartilhar";
import { useColecao } from "@/lib/dados/colecao";
import { medicationDoses, medications, type MedicationDose } from "@/lib/dados/colecoes";
import { rotuloDia } from "@/lib/dates";
import { useAgora } from "@/lib/hooks/useAgora";
import { useFuso } from "@/lib/hooks/useFuso";
import { tomarDose, tomarSeNecessario } from "@/lib/medicamentos/acoes";
import { ativos, diasNavegaveis, dosesDoDia, horaDaDose, podeRegistrarRetroativo, textoDaLista } from "@/lib/medicamentos/regras";
import { useAberturaPorLembrete } from "@/lib/lembretes/abertura";
import { dataNoFuso, horaNoFuso } from "@dominio/tempo.ts";

function Conteudo() {
  const meds = useColecao(medications);
  const doses = useColecao(medicationDoses);
  const tz = useFuso();
  const agora = useAgora(30_000);
  const params = useSearchParams();
  const router = useRouter();
  const { mostrar } = useToast();
  const hoje = dataNoFuso(agora, tz);
  const [dia, setDia] = useState(hoje);
  const [aberta, setAberta] = useState<{ dose: MedicationDose; origem: "app" | "push" } | null>(null);
  useAberturaPorLembrete();

  // RN-06: o toque na notificação (iPhone não tem botões) abre direto o sheet da dose.
  const doseDaUrl = params.get("dose");
  useEffect(() => {
    if (!doseDaUrl) return;
    const d = medicationDoses.obter(doseDaUrl);
    if (d && !d.apagado_em) {
      setDia(dataNoFuso(new Date(d.scheduled_at ?? Date.now()), tz));
      setAberta({ dose: d, origem: "push" });
    }
    router.replace("/medicamentos");
  }, [doseDaUrl, router, tz]);

  const doDia = useMemo(() => dosesDoDia(doses, dia, tz), [doses, dia, tz]);
  const porId = useMemo(() => new Map(meds.map((m) => [m.id, m])), [meds]);
  const seNecessario = ativos(meds).filter((m) => m.schedule_type === "as_needed");
  const dias = diasNavegaveis(agora, tz);

  if (meds.length === 0) {
    return (
      <Vazio
        icone={<Pill size={24} />}
        frase={copy.vazio}
        acao={<Botao onClick={() => router.push("/medicamentos/novo")}>{copy.cadastrar}</Botao>}
      />
    );
  }

  function tomeiAgora(d: MedicationDose) {
    const { minutosAtraso } = tomarDose(d, new Date(), "app");
    track("med_dose_taken", { source: "app", minutes_late: minutosAtraso });
    mostrar(copy.registrada);
  }

  async function compartilhar() {
    const r = await compartilharTexto(textoDaLista(meds, copy.listaTitulo));
    track("med_list_shared", {});
    if (r === "copiado") mostrar(copy.listaCopiada);
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-1">
      <div className="scroll-x-sem-barra -mx-5 px-5">
        <Escolha semRotulo rotulo={copy.titulo} opcoes={dias.map((d) => ({ valor: d, rotulo: rotuloDia(d, hoje) }))} valor={dia} onMudar={setDia} />
      </div>

      <section aria-label={rotuloDia(dia, hoje)}>
        {doDia.length === 0 ? (
          <Card>
            <p className="tipo-corpo text-texto-mudo">{copy.semDoses}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {doDia.map((d) => {
              const m = porId.get(d.medication_id);
              const final = d.status !== "pending";
              const rotulo =
                d.status === "pending"
                  ? copy.estados.pending(horaDaDose(d, tz))
                  : d.status === "taken"
                    ? copy.estados.taken(horaNoFuso(new Date(d.taken_at!), tz))
                    : copy.estados[d.status];
              const podeMexer = d.status === "pending" || ((d.status === "missed" || d.status === "skipped") && podeRegistrarRetroativo(d, agora, tz));
              return (
                <li key={d.id} className="flex items-center gap-3 rounded-card bg-superficie px-4 py-3 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
                  <button type="button" onClick={() => setAberta({ dose: d, origem: "app" })} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
                    <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full ${d.status === "taken" ? "bg-sucesso text-white" : m?.color_key === "acento" ? "bg-acento-suave text-texto" : "bg-primaria-suave text-primaria-texto"}`}>
                      {d.status === "taken" ? <Check size={18} strokeWidth={3} /> : <Pill size={18} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-texto">{m?.name ?? "—"}</span>
                      <span className="tipo-meta block">
                        {horaDaDose(d, tz)} · {rotulo}
                        {m?.dose ? ` · ${m.dose}` : ""}
                      </span>
                    </span>
                  </button>
                  {!final && dia === hoje ? (
                    <Botao variant="secundario" onClick={() => tomeiAgora(d)}>
                      {copy.tomei}
                    </Botao>
                  ) : (
                    podeMexer &&
                    d.status !== "taken" && (
                      <Botao variant="fantasma" onClick={() => setAberta({ dose: d, origem: "app" })}>
                        {copy.tomei}
                      </Botao>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dia === hoje && seNecessario.length > 0 && (
        <section>
          <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.seNecessario}</h2>
          <ul className="flex flex-col gap-2">
            {seNecessario.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-card bg-superficie px-4 py-3 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-texto">{m.name}</span>
                  {m.dose && <span className="tipo-meta block">{m.dose}</span>}
                </span>
                <Botao
                  variant="secundario"
                  onClick={() => {
                    tomarSeNecessario(m, new Date(), "app");
                    track("med_dose_taken", { source: "app", minutes_late: 0 });
                    mostrar(copy.registrada);
                  }}
                >
                  {copy.tomeiAgora}
                </Botao>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card compacto>
        <div className="-mx-4 divide-y divide-fio">
          <Link href="/medicamentos/lista" className="flex min-h-13 items-center gap-3 px-4 text-[15px] text-texto">
            <ListChecks size={18} aria-hidden className="text-primaria-texto" />
            {copy.meus}
          </Link>
          <Link href="/medicamentos/adesao" className="flex min-h-13 items-center gap-3 px-4 text-[15px] text-texto">
            <BarChart3 size={18} aria-hidden className="text-primaria-texto" />
            {copy.adesao}
          </Link>
          <button type="button" onClick={() => void compartilhar()} className="flex min-h-13 w-full items-center gap-3 px-4 text-left text-[15px] text-texto">
            <Share2 size={18} aria-hidden className="text-primaria-texto" />
            {copy.compartilhar}
          </button>
        </div>
      </Card>

      <SheetDose dose={aberta?.dose ?? null} med={aberta ? porId.get(aberta.dose.medication_id) : undefined} tz={tz} origem={aberta?.origem} onFechar={() => setAberta(null)} />
    </div>
  );
}

/** Funcionalidade 02 · tela Hoje: doses do dia em ordem, estado e "Tomei"; retroativo até 7 dias (RN-08). */
export default function PaginaMedicamentos() {
  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
      <Suspense>
        <Conteudo />
      </Suspense>
    </div>
  );
}
