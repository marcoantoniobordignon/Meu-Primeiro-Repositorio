"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { familiaCopy as copy } from "@/copy/familia";
import { track } from "@/lib/analytics";
import { novoId, useColecao } from "@/lib/dados/colecao";
import { bebes, convites, membros } from "@/lib/dados/colecoes";
import { estadoDoConvite, nomePapel } from "@/lib/familia/regras";
import { meuId } from "@/lib/familia/useFamilia";
import { guardarPerfil, lerPerfil } from "@/lib/onboarding/estado";
import { atualizarPerfil, usePerfil } from "@/lib/perfil";
import { garantirSessaoAnonima } from "@/lib/sessao";

/** CUI-02/03/09: aceitar convite. Sem servidor, só resolve convites gerados neste aparelho. */
export default function PaginaConvite() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const perfil = usePerfil();
  const lista = useColecao(convites);
  const familia = useColecao(membros);
  const criancas = useColecao(bebes);
  const [nome, setNome] = useState("");
  const [confirmarTroca, setConfirmarTroca] = useState(false);
  const { mostrar } = useToast();

  const convite = lista.find((c) => c.token === token);
  const estado = estadoDoConvite(convite);
  const quem = familia.find((m) => m.profile_id === convite?.criado_por)?.nome ?? "Alguém";
  const bebe = criancas.map((b) => b.nome).join(" e ") || "a gestação";

  useEffect(() => {
    void garantirSessaoAnonima();
    track("convite_aberto", { valido: estado === "valido" });
  }, [estado]);

  async function entrar() {
    if (!convite || estado !== "valido") return;
    const sessao = await garantirSessaoAnonima();
    const jaTemFamilia = Boolean(lerPerfil()) && !confirmarTroca;
    if (jaTemFamilia && perfil?.papel !== convite.papel) {
      setConfirmarTroca(true);
      return;
    }
    const id = sessao.uid || meuId();
    const existente = familia.find((m) => m.profile_id === id);
    membros.salvar({ id: existente?.id ?? novoId(), profile_id: id, nome: nome.trim() || existente?.nome || "Convidado", papel: convite.papel, convidado_por: convite.criado_por, ultimo_acesso_em: new Date().toISOString() });
    convites.salvar({ ...convite, usado_por: id, usado_em: new Date().toISOString() });
    if (lerPerfil()) atualizarPerfil({ papel: convite.papel, nome: nome.trim() || undefined });
    else guardarPerfil({ nome: nome.trim() || undefined, modo: criancas.length ? "bebe" : "gestacao", anonima: true, plano: "free", papel: convite.papel, onboardingConcluidoEm: new Date().toISOString() });
    track("convite_aceito", { papel: convite.papel, tinha_conta: !sessao.anonima });
    mostrar(copy.convite.entrou);
    router.replace("/hoje");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 bg-fundo px-5 py-10">
      {estado !== "valido" ? (
        <Card>
          <p className="tipo-saudacao text-texto">{estado === "expirado" ? copy.convite.expirado : copy.convite.invalido}</p>
        </Card>
      ) : (
        <>
          <h1 className="tipo-pergunta text-texto">{copy.convite.titulo(quem, bebe)}</h1>
          <p className="tipo-corpo text-texto-mudo">{copy.convite.apoio(nomePapel[convite!.papel])}</p>
          <CampoTexto rotulo={copy.convite.nome} value={nome} onChange={(e) => setNome(e.target.value)} autoCapitalize="words" />
          {confirmarTroca && (
            <Card tom="acento">
              <p className="tipo-corpo text-texto">{copy.convite.trocar}</p>
            </Card>
          )}
          <Botao largura="total" tamanho="lg" onClick={entrar}>
            {confirmarTroca ? copy.convite.trocarConfirma : copy.convite.entrar}
          </Botao>
          <p className="tipo-meta text-center">{copy.aviso}</p>
        </>
      )}
    </div>
  );
}
