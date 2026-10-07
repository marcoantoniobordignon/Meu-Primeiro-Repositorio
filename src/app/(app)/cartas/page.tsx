"use client";

import { ChevronRight, Download, Lock, Mail, PenLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SheetPaywall } from "@/components/features/paywall/SheetPaywall";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Interruptor } from "@/components/ui/Interruptor";
import { useToast } from "@/components/ui/Toast";
import { cartasCopy as copy } from "@/copy/cartas";
import { track } from "@/lib/analytics";
import { exportar } from "@/lib/cartas/acoes";
import { useCartas } from "@/lib/cartas/useCartas";
import { compartilharArquivo } from "@/lib/compartilhar";
import type { Carta } from "@/lib/dados/colecoes";
import { formatarComAno } from "@/lib/dates";
import { atualizarPerfil } from "@/lib/perfil";
import { exportavel, podeCriarCarta } from "@dominio/cartas.ts";
import { prefsCompletas } from "@dominio/prefs.ts";

/** Tela 1 "Cartas": rascunhos, lacradas (só título e data) e abertas; exportar e o e-mail anual. */
export default function PaginaCartas() {
  const router = useRouter();
  const { mostrar } = useToast();
  const { perfil, cartas, rascunhos, lacradas, abertas, premium, nomeDoBebe } = useCartas();
  const [paywall, setPaywall] = useState(false);
  if (!perfil) return null;
  const nome = nomeDoBebe ?? copy.bebe;

  function nova() {
    // RN-07: free escreve até 2 (as excluídas não contam).
    if (!podeCriarCarta(cartas.length, premium)) {
      setPaywall(true);
      return;
    }
    router.push("/cartas/escrever");
  }

  async function exportarTudo() {
    const { blob, cartas: n } = await exportar(cartas);
    if (!n) {
      mostrar(copy.nadaParaExportar);
      return;
    }
    // RN-10: Web Share com o arquivo; sem suporte, baixa.
    const r = await compartilharArquivo(new File([blob], "cartas-ninho.zip", { type: "application/zip" }));
    if (r === "cancelado" || r === "falhou") return;
    track("letter_exported", {});
    mostrar(copy.exportado(n));
  }

  const linha = (c: Carta, detalhe: string, Icone: typeof Lock) => (
    <li key={c.id}>
      <Link href={c.status === "draft" ? `/cartas/escrever?id=${c.id}` : `/cartas/ler?id=${c.id}`} className="flex min-h-14 items-center gap-3 py-2">
        <Icone size={18} aria-hidden className="shrink-0 text-primaria-texto" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-texto">{c.title}</span>
          <span className="tipo-meta block">{detalhe}</span>
        </span>
        <ChevronRight size={16} aria-hidden className="shrink-0 text-texto-mudo" />
      </Link>
    </li>
  );

  const secao = (chave: "draft" | "sealed" | "opened", lista: Carta[], detalhe: (c: Carta) => string, Icone: typeof Lock) =>
    lista.length > 0 && (
      <section aria-labelledby={`cartas-${chave}`}>
        <h2 id={`cartas-${chave}`} className="tipo-titulo-secao mb-1 text-texto-mudo">
          {copy.secoes[chave]}
        </h2>
        <ul className="divide-y divide-fio">{lista.map((c) => linha(c, detalhe(c), Icone))}</ul>
      </section>
    );

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-1">
        {cartas.length === 0 ? (
          <Card tom="suave">
            <h2 className="text-[17px] font-medium text-texto">{copy.vazio(nome)}</h2>
            <p className="tipo-corpo mt-1 text-texto-mudo">{copy.vazioApoio}</p>
            <div className="mt-3">
              <Botao icone={<PenLine size={16} aria-hidden />} onClick={nova}>
                {copy.escrever}
              </Botao>
            </div>
          </Card>
        ) : (
          <Botao largura="total" icone={<PenLine size={16} aria-hidden />} onClick={nova}>
            {copy.escrever}
          </Botao>
        )}

        {secao("draft", rascunhos, () => copy.para(nome), PenLine)}
        {secao("sealed", lacradas, (c) => (c.open_on ? copy.abreEm(formatarComAno(c.open_on)) : copy.semData), Lock)}
        {secao("opened", abertas, (c) => (c.opened_at ? copy.abriuEm(formatarComAno(c.opened_at.slice(0, 10))) : copy.para(nome)), Mail)}

        {cartas.some(exportavel) && (
          <Card>
            <p className="tipo-meta">{copy.exportarApoio}</p>
            <div className="mt-2">
              <Botao variant="secundario" icone={<Download size={16} aria-hidden />} onClick={() => void exportarTudo()}>
                {copy.exportar}
              </Botao>
            </div>
          </Card>
        )}

        {lacradas.length > 0 && (
          <Card compacto>
            <Interruptor
              rotulo={copy.emailAnual}
              apoio={copy.emailAnualApoio}
              ligado={prefsCompletas(perfil.prefs).letters_annual_email}
              onMudar={(v) => atualizarPerfil({ prefs: { ...perfil.prefs, letters_annual_email: v } })}
            />
          </Card>
        )}
      </div>
      <SheetPaywall aberto={paywall} gatilho={{ feature: "letters", trigger: "letter_limit" }} onFechar={() => setPaywall(false)} />
    </div>
  );
}
