"use client";

import { useRouter } from "next/navigation";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { nascimentoCopy as copy } from "@/copy/nascimento";
import { track } from "@/lib/analytics";
import { podeDesfazer, validarNascimento } from "@/lib/bebe/nascimento";
import { useBebes } from "@/lib/bebe/useBebes";
import { bebes as colecao } from "@/lib/dados/colecoes";
import { paraISO } from "@/lib/dates";
import { atualizarPerfil, usePerfil } from "@/lib/perfil";

/** VIR-06: corrigir a data do nascimento; "não nasceu ainda" só nas primeiras 24 h. Telefone da equipe. */
export default function PaginaEuBebe() {
  const perfil = usePerfil();
  const { bebes } = useBebes();
  const router = useRouter();
  const { mostrar } = useToast();
  if (!perfil) return null;

  const desfazivel = bebes.length > 0 && bebes.every((b) => podeDesfazer(b.registrado_em));

  function desfazer() {
    bebes.forEach((b) => colecao.apagar(b.id));
    atualizarPerfil({ modo: "gestacao", nascidoEm: undefined, cortesiaFim: null, bebeAtivoId: undefined });
    track("nascimento_desfeito", {});
    mostrar(copy.eu.desfeito);
    router.replace("/hoje");
  }

  return (
    <div>
      <Cabecalho titulo={copy.eu.titulo} voltarPara="/eu" />
      <div className="flex flex-col gap-4 px-5 pt-1">
        {bebes.map((b) => (
          <Card key={b.id}>
            <p className="tipo-titulo-secao mb-3 text-texto-mudo">{copy.eu.corrigir}</p>
            <div className="flex flex-col gap-3">
              <CampoTexto rotulo={copy.nome} defaultValue={b.nome} onBlur={(e) => e.target.value.trim() && colecao.salvar({ ...b, nome: e.target.value.trim() })} />
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <CampoTexto
                  rotulo={copy.data}
                  type="date"
                  defaultValue={paraISO(new Date(b.nascido_em))}
                  max={paraISO(new Date())}
                  onBlur={(e) => {
                    const d = new Date(b.nascido_em);
                    const [a, m, dia] = e.target.value.split("-").map(Number);
                    if (!a || !m || !dia) return;
                    d.setFullYear(a, m - 1, dia);
                    if (validarNascimento(d) === "futuro") return;
                    colecao.salvar({ ...b, nascido_em: d.toISOString() });
                    atualizarPerfil({ nascidoEm: paraISO(d) });
                    mostrar(copy.eu.salvo);
                  }}
                />
                <CampoTexto
                  rotulo={copy.hora}
                  type="time"
                  defaultValue={new Date(b.nascido_em).toTimeString().slice(0, 5)}
                  onBlur={(e) => {
                    const [h, min] = e.target.value.split(":").map(Number);
                    if (Number.isNaN(h)) return;
                    const d = new Date(b.nascido_em);
                    d.setHours(h!, min ?? 0, 0, 0);
                    colecao.salvar({ ...b, nascido_em: d.toISOString() });
                    mostrar(copy.eu.salvo);
                  }}
                />
              </div>
              <CampoTexto
                rotulo={copy.semanas}
                type="number"
                inputMode="numeric"
                min={20}
                max={42}
                defaultValue={b.prematuro_semanas ?? ""}
                onBlur={(e) => colecao.salvar({ ...b, prematuro_semanas: Number(e.target.value) >= 20 && Number(e.target.value) < 37 ? Number(e.target.value) : null })}
              />
            </div>
          </Card>
        ))}

        <Card>
          <CampoTexto rotulo={copy.eu.telefone} type="tel" inputMode="tel" ajuda={copy.eu.telefoneAjuda} defaultValue={perfil.telefoneEquipe ?? ""} onBlur={(e) => atualizarPerfil({ telefoneEquipe: e.target.value.trim() || undefined })} />
        </Card>

        {desfazivel && (
          <Card tom="acento">
            <p className="tipo-saudacao text-texto">{copy.eu.naoNasceu}</p>
            <p className="tipo-corpo mt-1 text-texto-mudo">{copy.eu.naoNasceuApoio}</p>
            <div className="mt-3">
              <Botao variant="secundario" onClick={desfazer}>
                {copy.eu.naoNasceu}
              </Botao>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
