"use client";

import { Heart, Volume2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { SheetEscolherNome } from "@/components/features/nomes/SheetEscolherNome";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { nomesCopy as copy } from "@/copy/nomes";
import { track } from "@/lib/analytics";
import { votar } from "@/lib/nomes/acoes";
import { significadoVisivel, useCatalogoDeNomes } from "@/lib/nomes/catalogo";
import { useNomes } from "@/lib/nomes/useNomes";
import { usePerfil } from "@/lib/perfil";
import { diaDoSanto } from "@dominio/fe.ts";
import { chaveDoVoto, iniciais, MAX_SOBRENOMES, nomeCompleto, podeEscolher, santoDoNome, silabasDoNomeCompleto } from "@dominio/nomes.ts";

function Conteudo() {
  const params = useSearchParams();
  const perfil = usePerfil();
  const { catalogo, comServidor } = useCatalogoDeNomes();
  const { porChave, chavesDeMatch, temParceiro } = useNomes();
  const [sobrenomes, setSobrenomes] = useState<string[]>(["", ""]);
  const [podeOuvir, setPodeOuvir] = useState(false);
  const [escolhendo, setEscolhendo] = useState<{ chave: string; nome: string } | null>(null);

  // RN-08: "Ouvir" só aparece com speechSynthesis.
  useEffect(() => setPodeOuvir(typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"), []);

  const id = params.get("id");
  const proprio = params.get("proprio");
  const doCatalogo = id ? catalogo.find((n) => n.id === id) : undefined;
  const nome = doCatalogo?.name ?? proprio ?? null;
  if (!perfil) return null;
  if (!nome)
    return (
      <div>
        <Cabecalho titulo={copy.titulo} voltarPara="/nomes" />
        <p className="tipo-corpo px-5 text-texto-mudo">{copy.detalhe.naoEncontrado}</p>
      </div>
    );

  const alvo = { name_id: doCatalogo?.id ?? null, custom_name: doCatalogo ? null : nome };
  const chave = chaveDoVoto(alvo);
  const voto = porChave.get(chave);
  const s = doCatalogo ? significadoVisivel(doCatalogo, comServidor) : { meaning: null, origin: null, rascunho: false };
  const santo = doCatalogo ? santoDoNome(doCatalogo, Boolean(perfil.prefs?.faith_mode)) : null;
  const completo = nomeCompleto(nome, sobrenomes);
  const escolhivel = podeEscolher({ temParceiro, ehMatch: chavesDeMatch.has(chave), curtido: voto?.vote === "like" });

  function ouvir() {
    const u = new SpeechSynthesisUtterance(completo);
    u.lang = "pt-BR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    track("names_listen_tapped", {});
  }

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/nomes" />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <header className="flex flex-col items-center gap-2 text-center">
          <h2 className="font-serifa text-[44px] leading-tight text-texto">{nome}</h2>
          <p className="tipo-corpo text-texto">{s.meaning ?? copy.significadoEmBreve}</p>
          {s.origin && <p className="tipo-meta">{copy.origemDe(s.origin)}</p>}
          {santo && <p className="tipo-meta">{copy.santo(santo.nome, diaDoSanto(santo.dia))}</p>}
          {s.rascunho && s.meaning && <span className="rounded-pilula bg-acento-suave px-2.5 py-0.5 text-[12px] font-medium text-texto">{copy.rascunho}</span>}
        </header>

        <Card>
          <h3 className="tipo-titulo-secao text-texto-mudo">{copy.detalhe.sobrenomes}</h3>
          <p className="tipo-meta">{copy.detalhe.sobrenomeApoio}</p>
          <div className="mt-2 flex flex-col gap-2">
            {Array.from({ length: MAX_SOBRENOMES }, (_, i) => (
              <CampoTexto
                key={i}
                rotulo={copy.detalhe.sobrenome(i + 1)}
                value={sobrenomes[i]}
                maxLength={40}
                autoCapitalize="words"
                autoComplete="off"
                onChange={(e) => setSobrenomes((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-0.5" aria-live="polite">
            <p className="font-serifa text-[22px] text-texto" data-nome-completo>
              {completo}
            </p>
            <p className="tipo-meta">
              {copy.detalhe.iniciais}: {iniciais(completo)} · {copy.detalhe.silabas(silabasDoNomeCompleto(nome, doCatalogo?.syllables ?? null, sobrenomes))}
            </p>
          </div>
          {podeOuvir && (
            <div className="mt-2">
              <Botao variant="secundario" icone={<Volume2 size={16} aria-hidden />} onClick={ouvir}>
                {copy.detalhe.ouvir}
              </Botao>
            </div>
          )}
        </Card>

        <div className="flex gap-2">
          <Botao
            largura="total"
            variant={voto?.vote === "dislike" ? "primario" : "secundario"}
            icone={<X size={16} aria-hidden />}
            aria-pressed={voto?.vote === "dislike"}
            onClick={() => {
              votar(alvo, "dislike");
              track("names_swipe", { vote: "dislike" });
            }}
          >
            {copy.descartar}
          </Botao>
          <Botao
            largura="total"
            variant={voto?.vote === "like" ? "primario" : "secundario"}
            icone={<Heart size={16} aria-hidden />}
            aria-pressed={voto?.vote === "like"}
            onClick={() => {
              votar(alvo, "like");
              track("names_swipe", { vote: "like" });
            }}
          >
            {copy.curtir}
          </Botao>
        </div>
        {escolhivel && (
          <Botao largura="total" tamanho="lg" onClick={() => setEscolhendo({ chave, nome })}>
            {copy.escolher.botao}
          </Botao>
        )}
      </div>
      <SheetEscolherNome alvo={escolhendo} onFechar={() => setEscolhendo(null)} />
    </div>
  );
}

/** Tela 2 "Detalhe do nome": significado, origem, santo (modo fé), ouvir, nome com sobrenomes e voto (RN-08/09). */
export default function PaginaNome() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
