"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { familiaCopy as copy } from "@/copy/familia";
import { track } from "@/lib/analytics";
import { novoId, useColecao } from "@/lib/dados/colecao";
import { bebes, convites, membros, type Papel } from "@/lib/dados/colecoes";
import { estadoDoConvite, nomePapel, type EstadoConvite } from "@/lib/familia/regras";
import { aceitarConviteRemoto, lerConvitePublico, temServidor } from "@/lib/familia/servidor";
import { meuId } from "@/lib/familia/useFamilia";
import { guardarPerfil, lerPerfil } from "@/lib/onboarding/estado";
import { sincronizar } from "@/lib/offline/sync";
import { atualizarPerfil, usePerfil } from "@/lib/perfil";
import { garantirSessaoAnonima } from "@/lib/sessao";

interface Vista {
  estado: EstadoConvite;
  papel?: Exclude<Papel, "mae">;
  quem: string;
  bebe: string;
}

/** CUI-02/03/09: aceitar convite de avó ou cuidador. Com servidor, pelas RPCs; sem, só convites deste aparelho. */
export function AceitarConviteFamilia({ token }: { token: string }) {
  const router = useRouter();
  const perfil = usePerfil();
  const locais = useColecao(convites);
  const familia = useColecao(membros);
  const criancas = useColecao(bebes);
  const [nome, setNome] = useState("");
  const [confirmarTroca, setConfirmarTroca] = useState(false);
  const [vista, setVista] = useState<Vista | null>(null);
  const [entrando, setEntrando] = useState(false);
  const { mostrar } = useToast();
  const remoto = temServidor();

  useEffect(() => {
    void garantirSessaoAnonima();
    if (remoto) {
      lerConvitePublico(token)
        .then((c) => {
          const v: Vista = { estado: c?.estado ?? "inexistente", papel: c?.papel, quem: c?.quem ?? "Alguém", bebe: c?.bebe ?? "a gestação" };
          setVista(v);
          track("convite_aberto", { valido: v.estado === "valido" });
        })
        .catch(() => setVista({ estado: "inexistente", quem: "", bebe: "" }));
      return;
    }
    const c = locais.find((x) => x.token === token);
    const estado = estadoDoConvite(c);
    setVista({
      estado,
      papel: c?.papel,
      quem: familia.find((m) => m.profile_id === c?.criado_por)?.nome ?? "Alguém",
      bebe: criancas.map((b) => b.nome).join(" e ") || "a gestação",
    });
    track("convite_aberto", { valido: estado === "valido" });
  }, [token, remoto, locais, familia, criancas]);

  async function entrar() {
    if (!vista || vista.estado !== "valido" || !vista.papel) return;
    const jaTemFamilia = Boolean(lerPerfil()) && !confirmarTroca;
    if (jaTemFamilia && perfil?.papel !== vista.papel) {
      setConfirmarTroca(true);
      return;
    }
    setEntrando(true);
    try {
      const sessao = await garantirSessaoAnonima();
      const id = sessao.uid || meuId();
      if (remoto) {
        await aceitarConviteRemoto(token, nome.trim() || null);
      } else {
        const c = locais.find((x) => x.token === token)!;
        const existente = familia.find((m) => m.profile_id === id);
        membros.salvar({ id: existente?.id ?? novoId(), profile_id: id, nome: nome.trim() || existente?.nome || "Convidado", papel: vista.papel, convidado_por: c.criado_por, ultimo_acesso_em: new Date().toISOString() });
        convites.salvar({ ...c, usado_por: id, usado_em: new Date().toISOString() });
      }
      if (lerPerfil()) atualizarPerfil({ papel: vista.papel, nome: nome.trim() || undefined });
      else guardarPerfil({ nome: nome.trim() || undefined, modo: criancas.length ? "bebe" : "gestacao", anonima: sessao.anonima, plano: "free", papel: vista.papel, onboardingConcluidoEm: new Date().toISOString() });
      track("convite_aceito", { papel: vista.papel, tinha_conta: !sessao.anonima });
      mostrar(copy.convite.entrou);
      if (remoto) void sincronizar();
      router.replace("/hoje");
    } catch {
      mostrar(copy.erroAceitar);
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 bg-fundo px-5 py-10">
      {!vista ? (
        <div aria-busy="true" />
      ) : vista.estado !== "valido" ? (
        <Card>
          <p className="tipo-saudacao text-texto">{vista.estado === "expirado" ? copy.convite.expirado : copy.convite.invalido}</p>
        </Card>
      ) : (
        <>
          <h1 className="tipo-pergunta text-texto">{copy.convite.titulo(vista.quem, vista.bebe)}</h1>
          <p className="tipo-corpo text-texto-mudo">{copy.convite.apoio(nomePapel[vista.papel!])}</p>
          <CampoTexto rotulo={copy.convite.nome} value={nome} onChange={(e) => setNome(e.target.value)} autoCapitalize="words" />
          {confirmarTroca && (
            <Card tom="acento">
              <p className="tipo-corpo text-texto">{copy.convite.trocar}</p>
            </Card>
          )}
          <Botao largura="total" tamanho="lg" onClick={entrar} carregando={entrando}>
            {confirmarTroca ? copy.convite.trocarConfirma : copy.convite.entrar}
          </Botao>
          {!remoto && <p className="tipo-meta text-center">{copy.aviso}</p>}
        </>
      )}
    </div>
  );
}
