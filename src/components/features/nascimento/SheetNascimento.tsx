"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { nascimentoCopy as copy } from "@/copy/nascimento";
import { track } from "@/lib/analytics";
import { cortesiaFim, semanasNoNascimento, semanasSeprematuro, validarNascimento } from "@/lib/bebe/nascimento";
import { novoId } from "@/lib/dados/colecao";
import { bebes } from "@/lib/dados/colecoes";
import { diasEntre, paraISO } from "@/lib/dates";
import { iniciarCortesiaRemota, temServidor } from "@/lib/familia/servidor";
import { atualizarPerfil, usePerfil } from "@/lib/perfil";

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

/** Sheet "Nasceu!": nome, data e hora, prematuro (VIR-05), gêmeos (VIR-01/02/04). */
export function SheetNascimento({ aberto, onFechar }: Props) {
  const perfil = usePerfil();
  const router = useRouter();
  const [nomes, setNomes] = useState<string[]>([""]);
  const [data, setData] = useState(() => paraISO(new Date()));
  const [hora, setHora] = useState(() => new Date().toTimeString().slice(0, 5));
  const [prematuro, setPrematuro] = useState(false);
  const [semanas, setSemanas] = useState("");
  const [confirmarAntigo, setConfirmarAntigo] = useState(false);
  const [tocou, setTocou] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNomes([""]);
    setData(paraISO(new Date()));
    setHora(new Date().toTimeString().slice(0, 5));
    setPrematuro(false);
    setSemanas("");
    setConfirmarAntigo(false);
    setTocou(false);
  }, [aberto]);

  // VIR-05: sugere as semanas quando nasceu antes de DPP − 21 dias.
  useEffect(() => {
    if (!perfil?.dpp) return;
    const sugestao = semanasSeprematuro(data, perfil.dpp);
    if (sugestao !== null) {
      setPrematuro(true);
      setSemanas(String(sugestao));
    }
  }, [data, perfil?.dpp]);

  const [a, m, d] = data.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  const nascido = new Date(a ?? 0, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0);
  const validade = validarNascimento(nascido);
  const nomesValidos = nomes.every((n) => n.trim().length > 0);

  function salvar() {
    setTocou(true);
    if (!nomesValidos || validade === "futuro") return;
    if (validade === "confirmar_antigo" && !confirmarAntigo) {
      setConfirmarAntigo(true);
      return;
    }
    const agora = new Date().toISOString();
    const prematuroSemanas = prematuro && Number(semanas) ? Number(semanas) : null;
    nomes.forEach((nome, i) =>
      bebes.salvar({ id: novoId(), nome: nome.trim(), nascido_em: nascido.toISOString(), prematuro_semanas: prematuroSemanas, ordem: i, aviso_soneca: false, registrado_em: agora }),
    );
    // VIR-02/08: a cortesia é calculada aqui (funciona sem rede) e confirmada pelo servidor quando houver.
    const cortesia = cortesiaFim(nascido.toISOString(), perfil?.plano === "ativo");
    atualizarPerfil({ modo: "bebe", nascidoEm: paraISO(nascido), cortesiaFim: cortesia, bebeAtivoId: undefined });
    if (cortesia) track("cortesia_iniciada", {});
    if (temServidor()) void iniciarCortesiaRemota(nascido.toISOString());
    track("nascimento_registrado", {
      semanas_gestacao: perfil?.dpp ? semanasNoNascimento(paraISO(nascido), perfil.dpp) : 40,
      prematuro: prematuroSemanas !== null,
      gemeos: nomes.length > 1,
      dias_apos_dpp: perfil?.dpp ? diasEntre(perfil.dpp, paraISO(nascido)) : 0,
    });
    onFechar();
    router.push("/bebe/bem-vindo");
  }

  return (
    <Sheet
      aberto={aberto}
      onFechar={onFechar}
      titulo={copy.sheetTitulo}
      rodape={
        <Botao largura="total" tamanho="lg" onClick={salvar} disabled={tocou && (!nomesValidos || validade === "futuro")}>
          {confirmarAntigo ? copy.confirmarSim : copy.salvar}
        </Botao>
      }
    >
      <div className="flex flex-col gap-4">
        {nomes.map((nome, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <CampoTexto
                rotulo={nomes.length > 1 ? `${copy.nome} ${i + 1}` : copy.nome}
                placeholder={copy.nomePlaceholder}
                value={nome}
                onChange={(e) => setNomes((l) => l.map((n, j) => (j === i ? e.target.value : n)))}
                erro={tocou && !nome.trim() ? copy.erroNome : undefined}
                autoCapitalize="words"
                autoFocus={i === 0}
              />
            </div>
            {nomes.length > 1 && (
              <button type="button" aria-label={copy.removerGemeo} onClick={() => setNomes((l) => l.filter((_, j) => j !== i))} className="grid size-13 place-items-center rounded-pilula text-texto-mudo">
                <X size={18} />
              </button>
            )}
          </div>
        ))}
        {nomes.length < 3 && (
          <button type="button" onClick={() => setNomes((l) => [...l, ""])} className="flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-primaria-texto">
            <Plus size={16} aria-hidden />
            {copy.gemeos}
          </button>
        )}

        <div className="grid grid-cols-[1fr_120px] gap-3">
          <CampoTexto rotulo={copy.data} type="date" value={data} max={paraISO(new Date())} onChange={(e) => setData(e.target.value)} erro={validade === "futuro" ? copy.erroFuturo : undefined} />
          <CampoTexto rotulo={copy.hora} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>

        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={prematuro} onChange={(e) => setPrematuro(e.target.checked)} className="size-5 accent-primaria" />
          <span className="tipo-corpo text-texto">{copy.prematuro}</span>
        </label>
        {prematuro && <CampoTexto rotulo={copy.semanas} type="number" inputMode="numeric" min={20} max={41} value={semanas} onChange={(e) => setSemanas(e.target.value)} />}

        {confirmarAntigo && (
          <Card tom="acento">
            <p className="tipo-corpo text-texto">{copy.confirmarAntigo}</p>
          </Card>
        )}
      </div>
    </Sheet>
  );
}
