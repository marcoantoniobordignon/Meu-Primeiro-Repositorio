"use client";

import { Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { nascimentoCopy as copy } from "@/copy/nascimento";
import { track } from "@/lib/analytics";
import { mostraCheckin, sinalDeAlerta } from "@/lib/bebe/nascimento";
import { novoId, useColecao } from "@/lib/dados/colecao";
import { posPartoCheckins, type Bebe, type PosPartoCheckin } from "@/lib/dados/colecoes";
import { diasEntre, paraISO } from "@/lib/dates";
import { usePerfil } from "@/lib/perfil";

/** VIR-07: check-in da mãe, 1x ao dia nas 6 primeiras semanas; orientação sem alarme. */
export function CardCheckin({ bebe }: { bebe: Bebe }) {
  const checkins = useColecao(posPartoCheckins);
  const perfil = usePerfil();
  const hoje = paraISO(new Date());
  const [dor, setDor] = useState<0 | 1 | 2 | 3 | null>(null);
  const [sangramento, setSangramento] = useState<PosPartoCheckin["sangramento"] | "nenhum" | null>(null);
  const [humor, setHumor] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const { mostrar } = useToast();

  const alerta = sinalDeAlerta(checkins, hoje);
  const pendente = mostraCheckin(bebe.nascido_em, checkins, hoje);
  if (!pendente && !alerta) return null;

  function guardar() {
    if (dor === null || humor === null || sangramento === null) return;
    const novo: PosPartoCheckin = { id: novoId(), data: hoje, dor, humor, sangramento: sangramento === "nenhum" ? null : sangramento, atualizado_em: "" };
    posPartoCheckins.salvar(novo);
    track("pos_parto_checkin", { dia: diasEntre(bebe.nascido_em.slice(0, 10), hoje), sinal_alerta: sinalDeAlerta([...checkins, novo], hoje) });
    mostrar(copy.checkin.salvo);
  }

  const opcao = (ativo: boolean, onClick: () => void, children: React.ReactNode, key: string) => (
    <button key={key} type="button" role="radio" aria-checked={ativo} onClick={onClick} className={`min-h-11 flex-1 rounded-pilula border px-2 text-[13px] font-medium ${ativo ? "border-acento bg-acento-suave text-texto" : "border-fio bg-superficie text-texto"}`}>
      {children}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {alerta && (
        <Card tom="acento">
          <p className="tipo-saudacao text-texto">{copy.checkin.alertaTitulo}</p>
          <p className="tipo-corpo mt-1 text-texto-mudo">{copy.checkin.alertaApoio}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/eu/pos-parto/sinais">
              <Botao variant="secundario">{copy.checkin.verSinais}</Botao>
            </Link>
            {perfil?.telefoneEquipe ? (
              <a href={`tel:${perfil.telefoneEquipe}`}>
                <Botao icone={<Phone size={16} aria-hidden />}>{copy.checkin.ligar}</Botao>
              </a>
            ) : (
              <Link href="/eu/bebe" className="tipo-meta flex min-h-11 items-center">
                {copy.checkin.semTelefone}
              </Link>
            )}
          </div>
        </Card>
      )}

      {pendente && (
        <Card>
          <p className="tipo-saudacao text-texto">{copy.checkin.titulo}</p>
          <p className="tipo-meta mt-0.5">{copy.checkin.apoio}</p>
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <span className="tipo-titulo-secao mb-1.5 block text-texto-mudo">{copy.checkin.dor}</span>
              <div role="radiogroup" aria-label={copy.checkin.dor} className="flex gap-1.5">
                {copy.checkin.dorNiveis.map((n, i) => opcao(dor === i, () => setDor(i as 0 | 1 | 2 | 3), n, n))}
              </div>
            </div>
            <div>
              <span className="tipo-titulo-secao mb-1.5 block text-texto-mudo">{copy.checkin.sangramento}</span>
              <div role="radiogroup" aria-label={copy.checkin.sangramento} className="flex gap-1.5">
                {(["nenhum", "leve", "moderado", "intenso"] as const).map((v) => opcao(sangramento === v, () => setSangramento(v), copy.checkin.sangramentoNiveis[v], v))}
              </div>
            </div>
            <div>
              <span className="tipo-titulo-secao mb-1.5 block text-texto-mudo">{copy.checkin.humor}</span>
              <div role="radiogroup" aria-label={copy.checkin.humor} className="flex gap-1.5">
                {copy.checkin.humorNiveis.map((e, i) => opcao(humor === i + 1, () => setHumor((i + 1) as 1 | 2 | 3 | 4 | 5), <span className="text-[20px]">{e}</span>, e))}
              </div>
            </div>
            <Botao largura="total" onClick={guardar} disabled={dor === null || humor === null || sangramento === null}>
              {copy.checkin.salvar}
            </Botao>
          </div>
        </Card>
      )}
    </div>
  );
}
