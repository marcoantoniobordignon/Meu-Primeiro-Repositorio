"use client";

import { Copy, Share2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Interruptor } from "@/components/ui/Interruptor";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { parceiroCopy as copy } from "@/copy/parceiro";
import { track } from "@/lib/analytics";
import { membros as colecao, type Membro } from "@/lib/dados/colecoes";
import { formatarQuando } from "@/lib/dates";
import { PERMISSOES_PARCEIRO_PADRAO, parceiroAtivo, type PermissoesParceiro } from "@/lib/familia/regras";
import { definirPermissoesRemoto, removerMembroRemoto, temServidor } from "@/lib/familia/servidor";
import { useFamilia } from "@/lib/familia/useFamilia";
import { estadoDoUltimo, ErroConvite, gerarConviteParceiro, ultimoConviteGerado, type ConviteGerado } from "@/lib/parceiro/convite";
import { mensagemDoConvite } from "@dominio/parceiro.ts";

/** Tela 1 "Gestante > Parceiro": convidar (link e código), estado do convite, permissões, remover. */
export default function PaginaParceiro() {
  const { membros, meuId, papel } = useFamilia();
  const { mostrar } = useToast();
  const [convite, setConvite] = useState<ConviteGerado | null>(null);
  const [gerando, setGerando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const parceiro = parceiroAtivo(membros);

  useEffect(() => setConvite(ultimoConviteGerado()), []);

  if (papel !== "mae") return <Cabecalho titulo={copy.titulo} voltarPara="/eu" />;
  const estado = estadoDoUltimo(convite);
  const link = convite && typeof location !== "undefined" ? `${location.origin}/convite/${convite.token}` : "";

  async function gerar() {
    setGerando(true);
    try {
      setConvite(await gerarConviteParceiro(meuId, membros));
      track("partner_invite_created", {});
    } catch (e) {
      mostrar(e instanceof ErroConvite && e.motivo === "ja_tem_parceiro" ? copy.jaTemParceiro : copy.erro);
    } finally {
      setGerando(false);
    }
  }

  async function enviar() {
    try {
      if (navigator.share) await navigator.share({ text: mensagemDoConvite(link) });
      else {
        await navigator.clipboard.writeText(mensagemDoConvite(link));
        mostrar(copy.copiado);
      }
    } catch {
      /* cancelou */
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      mostrar(copy.copiado);
    } catch {
      /* o link fica selecionável */
    }
  }

  async function mudar(m: Membro, chave: keyof PermissoesParceiro, valor: boolean) {
    const novas = { ...PERMISSOES_PARCEIRO_PADRAO, ...m.permissoes, [chave]: valor };
    colecao.salvar({ ...m, permissoes: novas });
    try {
      if (temServidor()) await definirPermissoesRemoto(m.profile_id, novas);
      track("partner_permission_changed", { key: chave, value: valor });
      mostrar(copy.salvo);
    } catch {
      colecao.salvar(m);
      mostrar(copy.erro);
    }
  }

  async function remover(m: Membro) {
    try {
      if (temServidor()) await removerMembroRemoto(m.profile_id);
      colecao.apagar(m.id);
      track("partner_removed", { by: "owner" });
      mostrar(copy.removido);
    } catch {
      mostrar(copy.erro);
    }
  }

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <p className="tipo-corpo text-texto-mudo">{copy.apoio}</p>

        {parceiro ? (
          <>
            <Card>
              <div className="flex items-center gap-3">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primaria-suave text-[15px] font-medium text-primaria-texto">
                  {parceiro.nome.trim()[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="text-[16px] font-medium text-texto">{parceiro.nome}</span>
              </div>
            </Card>
            <section>
              <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.permissoesTitulo}</h2>
              <Card compacto>
                <div className="flex flex-col divide-y divide-fio">
                  {(
                    [
                      ["agenda", copy.permissoes.agenda, copy.permissoes.agendaApoio],
                      ["belly_photos", copy.permissoes.fotos, copy.permissoes.fotosApoio],
                      ["birth_plan", copy.permissoes.plano, copy.permissoes.planoApoio],
                    ] as const
                  ).map(([chave, rotulo, apoio]) => (
                    <Interruptor key={chave} rotulo={rotulo} apoio={apoio} ligado={{ ...PERMISSOES_PARCEIRO_PADRAO, ...parceiro.permissoes }[chave]} onMudar={(v) => void mudar(parceiro, chave, v)} />
                  ))}
                </div>
              </Card>
              <p className="tipo-meta mt-2">{copy.sempreFora}</p>
            </section>
            <Botao variant="fantasma" onClick={() => setRemovendo(true)}>
              {copy.remover}
            </Botao>
            <SheetConfirmar
              aberto={removendo}
              titulo={copy.removerTitulo}
              texto={copy.removerTexto}
              confirmar={copy.remover}
              cancelar={copy.cancelar}
              onFechar={() => setRemovendo(false)}
              onConfirmar={() => void remover(parceiro)}
            />
          </>
        ) : convite && estado === "valido" ? (
          <>
            <Card tom="suave">
              <p className="tipo-titulo-secao text-texto-mudo">{copy.estado.valido}</p>
              <p className="tipo-meta mt-3">{copy.link}</p>
              <p className="tipo-corpo select-all break-all text-primaria-texto" data-testid="link-convite">
                {link}
              </p>
              <p className="tipo-meta mt-3">{copy.codigo}</p>
              <p className="font-mono text-[28px] font-semibold tracking-[0.3em] text-texto" data-testid="codigo-convite">
                {convite.code}
              </p>
              <p className="tipo-meta mt-1">{copy.codigoApoio}</p>
              <p className="tipo-meta mt-3">{copy.validade(formatarQuando(convite.expires_at))}</p>
            </Card>
            <div className="flex gap-2">
              <Botao largura="total" icone={<Share2 size={16} aria-hidden />} onClick={() => void enviar()}>
                {copy.compartilhar}
              </Botao>
              <Botao largura="total" variant="secundario" icone={<Copy size={16} aria-hidden />} onClick={() => void copiar()}>
                {copy.copiarLink}
              </Botao>
            </div>
            <Botao variant="fantasma" carregando={gerando} onClick={() => void gerar()}>
              {copy.gerarOutro}
            </Botao>
            <p className="tipo-meta -mt-2 text-center">{copy.gerarOutroApoio}</p>
          </>
        ) : (
          <>
            {convite && estado !== "inexistente" && <p className="tipo-corpo text-texto-mudo">{copy.estado[estado]}</p>}
            <Botao largura="total" tamanho="lg" icone={<UserPlus size={18} aria-hidden />} carregando={gerando} onClick={() => void gerar()}>
              {gerando ? copy.gerando : copy.convidar}
            </Botao>
            <p className="tipo-meta">{copy.sempreFora}</p>
          </>
        )}
        {!temServidor() && <p className="tipo-meta">{copy.precisaServidor}</p>}
      </div>
    </div>
  );
}
