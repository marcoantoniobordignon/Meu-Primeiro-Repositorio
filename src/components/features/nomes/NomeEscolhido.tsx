"use client";

import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { nomesCopy as copy } from "@/copy/nomes";
import { desfazerNome, ErroEscolha } from "@/lib/nomes/acoes";

/** RN-07: o nome escolhido em Eu, com "Desfazer a escolha". */
export function NomeEscolhido({ nome }: { nome: string }) {
  const { mostrar } = useToast();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <section>
      <Card compacto>
        <p className="text-[15px] font-medium text-texto">{copy.ajustes.escolhido(nome)}</p>
        {erro && (
          <p className="tipo-meta text-erro" role="alert">
            {erro}
          </p>
        )}
        <div className="mt-1">
          <Botao
            variant="fantasma"
            onClick={() =>
              void desfazerNome()
                .then(() => mostrar(copy.ajustes.desfeito))
                .catch((e: unknown) => setErro(e instanceof ErroEscolha && e.message === "sem_rede" ? copy.escolher.semRede : copy.escolher.erro))
            }
          >
            {copy.ajustes.desfazer}
          </Botao>
        </div>
      </Card>
    </section>
  );
}
