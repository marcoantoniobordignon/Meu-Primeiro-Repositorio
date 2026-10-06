"use client";

import { UserPlus, Users } from "lucide-react";
import { useState } from "react";

import { SheetConvite } from "@/components/features/familia/SheetConvite";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Interruptor } from "@/components/ui/Interruptor";
import { useToast } from "@/components/ui/Toast";
import { familiaCopy as copy } from "@/copy/familia";
import { track } from "@/lib/analytics";
import { membros as colecao } from "@/lib/dados/colecoes";
import { haQuantoTempo } from "@/lib/dates";
import type { Membro } from "@/lib/dados/colecoes";
import { nomePapel, PERMISSOES_PARCEIRO_PADRAO, type PermissoesParceiro } from "@/lib/familia/regras";
import { definirPermissoesRemoto, removerMembroRemoto, temServidor } from "@/lib/familia/servidor";
import { useFamilia } from "@/lib/familia/useFamilia";

/** Spec 12: membros com papel e último acesso; convidar e remover (CUI-01/08). */
export default function PaginaFamilia() {
  const { membros, meuId, permissoes } = useFamilia();
  const [convidando, setConvidando] = useState(false);
  const { mostrar } = useToast();

  async function remover(id: string, profileId: string, papel: string) {
    try {
      if (temServidor()) await removerMembroRemoto(profileId);
      colecao.apagar(id);
      track("membro_removido", { papel });
      mostrar(copy.removido);
    } catch {
      mostrar(copy.erroGerar);
    }
  }

  async function mudarPermissao(m: Membro, chave: keyof PermissoesParceiro, valor: boolean) {
    const novas = { ...PERMISSOES_PARCEIRO_PADRAO, ...m.permissoes, [chave]: valor };
    colecao.salvar({ ...m, permissoes: novas });
    try {
      if (temServidor()) await definirPermissoesRemoto(m.profile_id, novas);
      mostrar(copy.permissoes.salvo);
    } catch {
      colecao.salvar(m);
      mostrar(copy.erroGerar);
    }
  }

  const parceiros = permissoes.removerMembro ? membros.filter((m) => m.papel === "parceiro") : [];

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
      <div className="flex flex-col gap-4 px-5 pt-1">
        <p className="tipo-corpo text-texto-mudo">{copy.apoio}</p>

        <section>
          <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.membros}</h2>
          <Card compacto>
            <ul className="-mx-4 divide-y divide-fio">
              {membros.map((m) => (
                <li key={m.id} className="flex min-h-14 items-center gap-3 px-4">
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primaria-suave text-[14px] font-medium text-primaria-texto">
                    {m.nome.trim()[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-texto">
                      {m.nome}
                      {m.profile_id === meuId && <span className="tipo-meta"> · {copy.voce}</span>}
                    </span>
                    <span className="tipo-meta block">
                      {nomePapel[m.papel]} · {copy.ultimoAcesso(haQuantoTempo(m.ultimo_acesso_em))}
                    </span>
                  </span>
                  {permissoes.removerMembro && m.profile_id !== meuId && (
                    <Botao variant="fantasma" onClick={() => remover(m.id, m.profile_id, m.papel)}>
                      {copy.remover}
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {parceiros.map((m) => {
          const p = { ...PERMISSOES_PARCEIRO_PADRAO, ...m.permissoes };
          return (
            <section key={`perm-${m.id}`}>
              <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">
                {copy.permissoes.titulo} · {m.nome}
              </h2>
              <Card compacto>
                <div className="flex flex-col divide-y divide-fio">
                  <Interruptor rotulo={copy.permissoes.agenda} apoio={copy.permissoes.agendaApoio} ligado={p.agenda} onMudar={(v) => void mudarPermissao(m, "agenda", v)} />
                  <Interruptor rotulo={copy.permissoes.fotos} apoio={copy.permissoes.fotosApoio} ligado={p.belly_photos} onMudar={(v) => void mudarPermissao(m, "belly_photos", v)} />
                </div>
              </Card>
            </section>
          );
        })}

        {permissoes.gerarConvite ? (
          <Botao largura="total" tamanho="lg" icone={<UserPlus size={18} aria-hidden />} onClick={() => setConvidando(true)}>
            {copy.convidar}
          </Botao>
        ) : (
          <p className="tipo-meta flex items-center gap-2">
            <Users size={14} aria-hidden />
            {copy.semPermissao}
          </p>
        )}
      </div>
      <SheetConvite aberto={convidando} onFechar={() => setConvidando(false)} />
    </div>
  );
}
