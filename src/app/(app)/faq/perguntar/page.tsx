"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoArea } from "@/components/ui/CampoArea";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { faqCopy as copy } from "@/copy/faq";
import { track } from "@/lib/analytics";
import { ErroDaPergunta, parecidas, perguntar, votar, type Parecida } from "@/lib/faq/acoes";
import { validarPergunta } from "@dominio/faq.ts";

function Conteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const { mostrar } = useToast();
  const [texto, setTexto] = useState(params.get("texto") ?? "");
  const [sugestoes, setSugestoes] = useState<Parecida[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // RN-06: sugere as parecidas enquanto ela escreve (precisa de rede; sem rede, nada).
  useEffect(() => {
    if (texto.trim().length < 3) return setSugestoes([]);
    const t = setTimeout(() => {
      parecidas(texto)
        .then(setSugestoes)
        .catch(() => setSugestoes([]));
    }, 500);
    return () => clearTimeout(t);
  }, [texto]);

  async function enviar() {
    setErro(null);
    const local = validarPergunta(texto);
    if (local) return setErro(copy.erros[local]);
    setEnviando(true);
    try {
      await perguntar(texto);
      track("faq_question_submitted", {});
      mostrar(copy.enviada);
      router.replace("/faq");
    } catch (e) {
      const motivo = e instanceof ErroDaPergunta ? e.motivo : "desconhecido";
      setErro(copy.erros[motivo]);
      if (motivo === "parecida") void parecidas(texto).then(setSugestoes).catch(() => undefined);
    } finally {
      setEnviando(false);
    }
  }

  async function tambem(p: Parecida) {
    try {
      const n = await votar(p.id);
      track("faq_question_voted", {});
      setSugestoes((l) => l.map((x) => (x.id === p.id ? { ...x, votes_count: n, ja_votei: true } : x)));
      mostrar(copy.votado);
    } catch (e) {
      setErro(copy.erros[e instanceof ErroDaPergunta ? e.motivo : "desconhecido"]);
    }
  }

  return (
    <div>
      <Cabecalho titulo={copy.perguntarTitulo} voltarPara="/faq" />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <p className="tipo-corpo text-texto-mudo">{copy.perguntarApoio}</p>
        <CampoArea rotulo={copy.pergunta} value={texto} maxLength={140} rows={3} onChange={(e) => setTexto(e.target.value)} />
        {sugestoes.length > 0 && (
          <section aria-labelledby="ja-perguntaram">
            <h2 id="ja-perguntaram" className="tipo-titulo-secao mb-2 text-texto-mudo">
              {copy.jaPerguntaram}
            </h2>
            <ul className="flex flex-col gap-2">
              {sugestoes.map((p) => (
                <li key={p.id}>
                  <Card>
                    <p className="tipo-corpo text-texto">{p.text}</p>
                    <p className="tipo-meta mt-1">{copy.votos(p.votes_count)}</p>
                    <div className="mt-2">
                      {p.ja_votei ? (
                        <p className="tipo-meta">{copy.jaVotou}</p>
                      ) : (
                        <Botao variant="secundario" onClick={() => void tambem(p)}>
                          {copy.tambemQuero}
                        </Botao>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
        {erro && (
          <p className="text-[14px] text-erro" role="alert">
            {erro}
          </p>
        )}
        <Botao largura="total" tamanho="lg" carregando={enviando} onClick={() => void enviar()}>
          {copy.enviar}
        </Botao>
      </div>
    </div>
  );
}

/** Tela 4 "Perguntar": texto, parecidas e "Eu também quero saber" (RN-05/06). Pede conexão. */
export default function PaginaPerguntar() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
