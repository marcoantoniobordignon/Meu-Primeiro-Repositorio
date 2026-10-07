"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { nomesCopy as copy } from "@/copy/nomes";
import { track } from "@/lib/analytics";
import { ErroEscolha, escolherNome } from "@/lib/nomes/acoes";

/** RN-07: "Este é o nome!" pede confirmação, grava o nome do bebê e abre o marco "Escolhemos o nome" do diário. */
export function SheetEscolherNome({ alvo, onFechar }: { alvo: { chave: string; nome: string } | null; onFechar: () => void }) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (!alvo) return;
    setEnviando(true);
    setErro(null);
    try {
      const nome = await escolherNome(alvo.chave, alvo.nome);
      track("names_chosen", {});
      mostrar(copy.escolher.pronto(nome));
      onFechar();
      router.push("/diario/escrever?marco=name_chosen");
    } catch (e) {
      const m = e instanceof ErroEscolha ? e.message : "";
      setErro(m === "sem_rede" ? copy.escolher.semRede : m === "nome_sem_match" ? copy.escolher.semMatch : copy.escolher.erro);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Sheet aberto={Boolean(alvo)} onFechar={onFechar} titulo={alvo ? copy.escolher.titulo(alvo.nome) : undefined}>
      <p className="tipo-corpo text-texto-mudo">{copy.escolher.texto}</p>
      {erro && (
        <p className="tipo-corpo mt-3 text-erro" role="alert">
          {erro}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Botao largura="total" variant="secundario" onClick={onFechar}>
          {copy.escolher.cancelar}
        </Botao>
        <Botao largura="total" onClick={() => void confirmar()} disabled={enviando}>
          {copy.escolher.confirmar}
        </Botao>
      </div>
    </Sheet>
  );
}
