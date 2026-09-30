"use client";

import { Copy, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { familiaCopy as copy } from "@/copy/familia";
import { track } from "@/lib/analytics";
import { novoId } from "@/lib/dados/colecao";
import { convites, type Papel } from "@/lib/dados/colecoes";
import { CONVITE_VALIDADE_MS, gerarToken } from "@/lib/familia/regras";
import { criarConviteRemoto, temServidor } from "@/lib/familia/servidor";
import { useFamilia } from "@/lib/familia/useFamilia";

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

/** Sheet "Convidar": papel, link (72 h, uma vez). QR fica para quando houver servidor. */
export function SheetConvite({ aberto, onFechar }: Props) {
  const { permissoes, meuId } = useFamilia();
  const [papel, setPapel] = useState<Exclude<Papel, "mae">>("parceiro");
  const [link, setLink] = useState("");
  const { mostrar } = useToast();

  const podeConvidar = permissoes.podeConvidar.join(",");
  useEffect(() => {
    if (!aberto) return;
    setLink("");
    setPapel((podeConvidar.split(",")[0] as Exclude<Papel, "mae">) || "cuidador");
  }, [aberto, podeConvidar]);

  const [gerando, setGerando] = useState(false);
  const remoto = temServidor();

  async function gerar() {
    setGerando(true);
    try {
      let token: string | null = null;
      if (remoto) token = await criarConviteRemoto(papel);
      if (!token) {
        token = gerarToken();
        convites.salvar({ id: novoId(), token, papel, criado_por: meuId, expira_em: new Date(Date.now() + CONVITE_VALIDADE_MS).toISOString() });
      }
      track("convite_gerado", { papel });
      setLink(`${location.origin}/convite/${token}`);
    } catch {
      mostrar(copy.erroGerar);
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      mostrar(copy.copiado);
    } catch {
      /* o texto fica selecionável abaixo */
    }
  }

  async function compartilhar() {
    try {
      await navigator.share?.({ url: link });
    } catch {
      /* cancelado */
    }
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo={copy.sheetTitulo}>
      <p className="tipo-corpo text-texto-mudo">{copy.sheetApoio}</p>
      <div role="radiogroup" aria-label={copy.papelRotulo} className="mt-4 flex flex-col gap-2">
        {permissoes.podeConvidar.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={papel === p} onClick={() => setPapel(p)} className={`flex min-h-13 items-center rounded-card border-2 px-4 text-left ${papel === p ? "border-acento bg-acento-suave" : "border-transparent bg-superficie [[data-tema=escuro]_&]:border-fio"}`}>
            <span>
              <span className="block text-[15px] font-medium text-texto">{copy.papeis[p].titulo}</span>
              <span className="tipo-meta block">{copy.papeis[p].desc}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {link ? (
          <>
            <Card tom="suave">
              <p className="tipo-corpo select-all break-all text-primaria-texto">{link}</p>
            </Card>
            <div className="flex gap-2">
              <Botao largura="total" icone={<Copy size={16} aria-hidden />} onClick={copiar}>
                {copy.copiar}
              </Botao>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Botao largura="total" variant="secundario" icone={<Share2 size={16} aria-hidden />} onClick={compartilhar}>
                  {copy.compartilhar}
                </Botao>
              )}
            </div>
            {!remoto && <p className="tipo-meta">{copy.aviso}</p>}
          </>
        ) : (
          <Botao largura="total" tamanho="lg" onClick={gerar} carregando={gerando}>
            {copy.gerar}
          </Botao>
        )}
      </div>
    </Sheet>
  );
}
