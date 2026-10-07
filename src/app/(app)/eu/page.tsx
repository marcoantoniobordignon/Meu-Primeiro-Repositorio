"use client";

import { Apple, Baby, Bell, BookOpen, Bookmark, CalendarDays, CalendarRange, Camera, ChevronRight, Church, ClipboardList, Droplets, FlaskConical, FolderHeart, Heart, Mail, NotebookPen, Pill, Scale, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { Interruptor } from "@/components/ui/Interruptor";
import { useTema, type Tema } from "@/components/ui/ProvedorTema";
import { Sheet } from "@/components/ui/Sheet";
import { PermissaoIa } from "@/components/features/galeria/PermissaoIa";
import { AjustesParceiro } from "@/components/features/parceiro/AjustesParceiro";
import { AtivarAvisos } from "@/components/features/lembretes/AtivarAvisos";
import { NomeEscolhido } from "@/components/features/nomes/NomeEscolhido";
import { euCopy as copy } from "@/copy/eu";
import { feCopy } from "@/copy/fe";
import { onboarding as onbCopy } from "@/copy/onboarding";
import { track } from "@/lib/analytics";
import { useColecao } from "@/lib/dados/colecao";
import { avisos, todasColecoes } from "@/lib/dados/colecoes";
import { ehISOValida } from "@/lib/dates";
import { limparEstado } from "@/lib/onboarding/estado";
import { useFamilia } from "@/lib/familia/useFamilia";
import { definirModoFe, definirOracaoNoPush } from "@/lib/fe/acoes";
import { atualizarPerfil, limparPerfil, usePerfil } from "@/lib/perfil";
import { prefsCompletas, type Prefs } from "@dominio/prefs.ts";

export default function PaginaEu() {
  const perfil = usePerfil();
  const { tema, definirTema } = useTema();
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [palavra, setPalavra] = useState("");
  const { permissoes, papel, meuId } = useFamilia();
  const naoLidos = useColecao(avisos).filter((a) => a.para === meuId && !a.lido_em).length;
  if (!perfil) return null;
  const prefs = prefsCompletas(perfil.prefs);
  const mudarPref = (mudanca: Prefs) => atualizarPerfil({ prefs: { ...perfil.prefs, ...mudanca } });
  const gestacao = perfil.modo === "gestacao";

  function mudarTema(t: Tema) {
    definirTema(t);
    track("tema_alterado", { tema: t });
  }

  function recomecar() {
    todasColecoes.forEach((c) => c.limpar());
    limparEstado();
    limparPerfil();
    router.replace("/onboarding");
  }

  const atalho = (href: string, rotulo: string, Icone: typeof Bookmark) => (
    <Link href={href} className="flex min-h-13 items-center gap-3 px-4 text-[15px] text-texto">
      <Icone size={18} aria-hidden className="text-primaria-texto" />
      <span className="flex-1">{rotulo}</span>
      <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
    </Link>
  );

  return (
    <div className="flex flex-col gap-5 px-5">
      <header className="safe-top">
        <h1 className="tipo-saudacao text-texto">{copy.titulo}</h1>
      </header>

      <Card>
        <div className="flex flex-col gap-4">
          <CampoTexto
            rotulo={copy.nome}
            defaultValue={perfil.nome ?? ""}
            placeholder={onbCopy.nome.placeholder}
            onBlur={(e) => atualizarPerfil({ nome: e.target.value.trim() || undefined })}
            autoComplete="given-name"
          />
          {perfil.modo === "gestacao" ? (
            <CampoTexto rotulo={copy.dpp} type="date" defaultValue={perfil.dpp ?? ""} onBlur={(e) => ehISOValida(e.target.value) && atualizarPerfil({ dpp: e.target.value })} />
          ) : (
            <CampoTexto rotulo={copy.nascimento} type="date" defaultValue={perfil.nascidoEm ?? ""} onBlur={(e) => ehISOValida(e.target.value) && atualizarPerfil({ nascidoEm: e.target.value })} />
          )}
        </div>
      </Card>

      <section>
        <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.tema}</h2>
        <div role="radiogroup" aria-label={copy.tema} className="flex rounded-pilula bg-primaria-suave p-1">
          {(["auto", "claro", "escuro"] as Tema[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tema === t}
              onClick={() => mudarTema(t)}
              className={`min-h-10 flex-1 rounded-pilula text-[14px] font-medium transition-colors ${tema === t ? "bg-superficie text-primaria-texto" : "text-primaria-texto/80"}`}
            >
              {copy.temas[t]}
            </button>
          ))}
        </div>
      </section>

      <Card compacto>
        <div className="-mx-4 divide-y divide-fio">
          {perfil.modo === "bebe" && atalho("/eu/bebe", copy.bebe, Baby)}
          {gestacao && papel === "mae" && atalho("/eu/parceiro", copy.parceiro, Heart)}
          {atalho("/eu/familia", copy.familia, Users)}
          {atalho("/eu/avisos", naoLidos ? `${copy.avisos} · ${copy.novos(naoLidos)}` : copy.avisos, Bell)}
          {gestacao && permissoes.verAgenda && atalho("/calendario", copy.calendario, CalendarRange)}
          {permissoes.verAgenda && atalho("/consultas", copy.consultas, CalendarDays)}
          {permissoes.verMedicamentos && atalho("/medicamentos", copy.medicamentos, Pill)}
          {gestacao && permissoes.verExames && atalho("/exames", copy.exames, FlaskConical)}
          {gestacao && permissoes.verGaleria && atalho("/galeria", copy.galeria, FolderHeart)}
          {gestacao && permissoes.verPlanoParto && atalho("/plano-parto", copy.planoParto, ClipboardList)}
          {gestacao && permissoes.verFotosBarriga && atalho("/barriga", copy.barriga, Camera)}
          {gestacao && permissoes.verDiario && atalho("/diario", copy.diarioGravidez, Sparkles)}
          {gestacao && atalho("/artigos", copy.artigos, BookOpen)}
          {gestacao && (papel === "mae" || papel === "parceiro") && atalho("/nomes", copy.nomes, Baby)}
          {(papel === "mae" || papel === "parceiro") && atalho("/cartas", copy.cartas, Mail)}
          {atalho("/direitos", copy.direitos, Scale)}
          {atalho("/faq", copy.faq, Apple)}
          {atalho("/hoje/diario", copy.diario, NotebookPen)}
          {atalho("/eu/guardados", copy.guardados, Bookmark)}
        </div>
      </Card>

      <section>
        <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.notificacoes}</h2>
        <Card compacto>
          <div className="flex flex-col divide-y divide-fio">
            <AtivarAvisos />
            <Interruptor rotulo={copy.discreto} apoio={copy.discretoApoio} ligado={prefs.notifications_discreet} onMudar={(v) => mudarPref({ notifications_discreet: v })} />
            <Interruptor rotulo={copy.suspensas} apoio={copy.suspensasApoio} ligado={prefs.notifications_suspended} onMudar={(v) => mudarPref({ notifications_suspended: v })} />
          </div>
        </Card>
      </section>

      {perfil.nomeDoBebe && (papel === "mae" || papel === "parceiro") && <NomeEscolhido nome={perfil.nomeDoBebe} />}

      {/* Funcionalidade 17 · Tela 5: a chave do modo fé e a seção "Fé" (RN-02: desligar oculta e não apaga nada). */}
      <section>
        <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{feCopy.ajustes.secao}</h2>
        <Card compacto>
          <div className="flex flex-col divide-y divide-fio">
            <Interruptor rotulo={feCopy.ajustes.modo} apoio={feCopy.ajustes.modoApoio} ligado={prefs.faith_mode} onMudar={definirModoFe} />
            {prefs.faith_mode && gestacao && (
              <Interruptor rotulo={feCopy.ajustes.push} apoio={feCopy.ajustes.pushApoio} ligado={prefs.faith_weekly_push} onMudar={definirOracaoNoPush} />
            )}
          </div>
          {prefs.faith_mode && (
            <div className="-mx-4 mt-1 divide-y divide-fio border-t border-fio">
              {atalho("/fe", feCopy.ajustes.biblioteca, Church)}
              {!gestacao && papel === "mae" && atalho("/fe/batismo", feCopy.ajustes.batismo, Droplets)}
            </div>
          )}
        </Card>
      </section>

      {papel === "mae" && <PermissaoIa perfil={perfil} />}
      {papel === "parceiro" && <AjustesParceiro perfil={perfil} eu={meuId} />}

      <section>
        <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.conta}</h2>
        <Card compacto>
          <p className="tipo-corpo text-texto-mudo">{perfil.anonima ? copy.anonima : "—"}</p>
        </Card>
      </section>

      <Botao variant="fantasma" onClick={() => setConfirmando(true)}>
        {copy.recomecar}
      </Botao>

      <Sheet aberto={confirmando} onFechar={() => setConfirmando(false)} titulo={copy.recomecar}>
        <p className="tipo-corpo text-texto-mudo">{copy.recomecarConfirma}</p>
        <div className="mt-4">
          <CampoTexto rotulo="" value={palavra} onChange={(e) => setPalavra(e.target.value)} autoCapitalize="none" autoFocus />
        </div>
        <div className="mt-4 flex gap-2">
          <Botao largura="total" variant="secundario" onClick={() => setConfirmando(false)}>
            {copy.cancelar}
          </Botao>
          <Botao largura="total" disabled={palavra.trim().toLowerCase() !== "apagar"} onClick={recomecar}>
            {copy.confirmar}
          </Botao>
        </div>
      </Sheet>
    </div>
  );
}
