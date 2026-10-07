"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { useToast } from "@/components/ui/Toast";
import { nomesCopy as copy } from "@/copy/nomes";
import { track } from "@/lib/analytics";
import { adicionarNomeProprio } from "@/lib/nomes/acoes";
import { useCatalogoDeNomes } from "@/lib/nomes/catalogo";
import { MAX_NOME_PROPRIO, normalizarNomeProprio } from "@dominio/nomes.ts";

/** Tela 4 "Adicionar nome": o nome entra como curtido e conta para o match (RN-10). */
export default function PaginaAdicionarNome() {
  const router = useRouter();
  const { mostrar } = useToast();
  const { catalogo } = useCatalogoDeNomes();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    const r = adicionarNomeProprio(texto, catalogo);
    if (r === "invalido") {
      setErro(copy.adicionar.invalido);
      return;
    }
    track("names_custom_added", {});
    mostrar(copy.adicionar.adicionado(normalizarNomeProprio(texto)));
    router.push("/nomes/meus?aba=curtidos");
  }

  return (
    <div>
      <Cabecalho titulo={copy.adicionar.titulo} voltarPara="/nomes" />
      <form
        className="flex flex-col gap-4 px-5 pb-8 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <CampoTexto
          rotulo={copy.adicionar.campo}
          placeholder={copy.adicionar.placeholder}
          value={texto}
          maxLength={MAX_NOME_PROPRIO + 10}
          autoCapitalize="words"
          autoComplete="off"
          onChange={(e) => {
            setTexto(e.target.value);
            setErro(null);
          }}
          erro={erro ?? undefined}
        />
        <p className="tipo-meta">{copy.adicionar.apoio}</p>
        <Botao type="submit" largura="total" tamanho="lg" disabled={!texto.trim()}>
          {copy.adicionar.salvar}
        </Botao>
      </form>
    </div>
  );
}
