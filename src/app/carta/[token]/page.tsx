"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { cartasCopy } from "@/copy/cartas";

const copy = cartasCopy.publica;

interface CartaPublica {
  titulo: string;
  texto: string | null;
  audio: string | null;
  foto: string | null;
}

type Estado = { tipo: "carregando" } | { tipo: "ok"; carta: CartaPublica } | { tipo: "nao_encontrada" } | { tipo: "erro" };

/**
 * Tela 5 "Leitura pública" (RN-06): só a carta (título, texto, áudio e foto), sem login e sem nenhum dado da
 * gestação. O token vai para a Edge Function `carta-publica`; vencido ou revogado não abre.
 */
export default function PaginaCartaPublica() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base || !/^[a-f0-9]{64}$/.test(token)) {
      setEstado({ tipo: "nao_encontrada" });
      return;
    }
    fetch(`${base}/functions/v1/carta-publica?token=${token}`, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async (r) => {
        if (r.status === 404) return setEstado({ tipo: "nao_encontrada" });
        if (!r.ok) return setEstado({ tipo: "erro" });
        setEstado({ tipo: "ok", carta: (await r.json()) as CartaPublica });
      })
      .catch(() => setEstado({ tipo: "erro" }));
  }, [token]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 bg-fundo px-5 py-10">
      {estado.tipo === "carregando" && (
        <p className="tipo-corpo text-texto-mudo" aria-busy="true">
          {copy.carregando}
        </p>
      )}
      {estado.tipo === "nao_encontrada" && (
        <Card>
          <p className="tipo-corpo text-texto">{copy.naoEncontrada}</p>
        </Card>
      )}
      {estado.tipo === "erro" && (
        <Card>
          <p className="tipo-corpo text-texto" role="alert">
            {copy.erro}
          </p>
        </Card>
      )}
      {estado.tipo === "ok" && (
        <article className="flex flex-col gap-4">
          <h1 className="font-serifa text-[30px] leading-tight text-texto">{estado.carta.titulo}</h1>
          {estado.carta.texto && <div className="font-serifa whitespace-pre-line text-[18px] leading-relaxed text-texto">{estado.carta.texto}</div>}
          {estado.carta.audio && (
            <audio controls src={estado.carta.audio} aria-label={copy.audio} className="w-full">
              <track kind="captions" />
            </audio>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, de 1 hora */}
          {estado.carta.foto && <img src={estado.carta.foto} alt={copy.foto} className="w-full rounded-card" />}
          <p className="tipo-meta pt-4">{copy.rodape}</p>
        </article>
      )}
    </main>
  );
}
