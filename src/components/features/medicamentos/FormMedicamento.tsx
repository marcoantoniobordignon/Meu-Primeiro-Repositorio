"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SheetPaywall } from "@/components/features/paywall/SheetPaywall";
import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { Escolha } from "@/components/ui/Escolha";
import { Interruptor } from "@/components/ui/Interruptor";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { medicamentosCopy as copy } from "@/copy/medicamentos";
import { track } from "@/lib/analytics";
import { novoId, useColecao } from "@/lib/dados/colecao";
import { medications, type Medication } from "@/lib/dados/colecoes";
import { useFuso } from "@/lib/hooks/useFuso";
import { apagarMedicamento, salvarMedicamento } from "@/lib/medicamentos/acoes";
import { podeAtivarMais, sugestoesDeNome } from "@/lib/medicamentos/regras";
import { temPlano, usePerfil } from "@/lib/perfil";
import { validaAgenda, type ScheduleType } from "@dominio/medicamentos.ts";
import { dataNoFuso } from "@dominio/tempo.ts";

interface Props {
  existente?: Medication;
}

const TIPOS: ScheduleType[] = ["fixed_times", "interval", "weekdays", "as_needed"];
const INTERVALOS = [4, 6, 8, 12, 24];

/** Cadastro e edição (RN-01/02/11/15). O app não sugere dose: só autocompleta o nome. */
export function FormMedicamento({ existente }: Props) {
  const router = useRouter();
  const tz = useFuso();
  const perfil = usePerfil();
  const todos = useColecao(medications);
  const { mostrar } = useToast();
  const hoje = dataNoFuso(new Date(), tz);

  const [name, setName] = useState(existente?.name ?? "");
  const [dose, setDose] = useState(existente?.dose ?? "");
  const [instructions, setInstructions] = useState(existente?.instructions ?? "");
  const [tipo, setTipo] = useState<ScheduleType>(existente?.schedule_type ?? "fixed_times");
  const [times, setTimes] = useState<string[]>(existente?.times?.length ? existente.times : ["08:00"]);
  const [intervalo, setIntervalo] = useState(existente?.interval_hours ?? 8);
  const [ancora, setAncora] = useState(existente?.interval_anchor ?? "08:00");
  const [weekdays, setWeekdays] = useState<number[]>(existente?.weekdays ?? [1, 2, 3, 4, 5]);
  const [inicio, setInicio] = useState(existente?.starts_on ?? hoje);
  const [fim, setFim] = useState(existente?.ends_on ?? "");
  const [lembrete, setLembrete] = useState(existente?.reminders_on ?? true);
  const [tocou, setTocou] = useState(false);
  const [focoNome, setFocoNome] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [apagando, setApagando] = useState(false);

  const sugestoes = focoNome ? sugestoesDeNome(name) : [];
  const agenda = {
    schedule_type: tipo,
    times: tipo === "fixed_times" || tipo === "weekdays" ? times.filter(Boolean) : null,
    interval_hours: tipo === "interval" ? intervalo : null,
    interval_anchor: tipo === "interval" ? ancora : null,
    weekdays: tipo === "weekdays" ? weekdays : null,
    starts_on: inicio,
    ends_on: fim || null,
  };
  const erroAgenda = validaAgenda(agenda);
  const erroNome = !name.trim() ? copy.nomeErro : undefined;

  function salvar(reativar = false) {
    setTocou(true);
    if (erroNome || erroAgenda) return;
    const ativo = reativar ? true : (existente?.is_active ?? true);
    // RN-11: ativar mais um além do limite do free abre o paywall; os existentes seguem.
    const contaComoNovo = ativo && !(existente?.is_active && !existente.apagado_em);
    if (contaComoNovo && !podeAtivarMais(todos.filter((m) => m.id !== existente?.id), temPlano(perfil))) {
      setPaywall(true);
      return;
    }
    const corUsadas = todos.filter((m) => m.is_active).length;
    salvarMedicamento(
      {
        id: existente?.id ?? novoId(),
        name: name.trim().slice(0, 80),
        dose: dose.trim().slice(0, 40) || null,
        instructions: instructions.trim().slice(0, 120) || null,
        ...agenda,
        is_active: ativo,
        reminders_on: tipo === "as_needed" ? false : lembrete,
        color_key: existente?.color_key ?? (corUsadas % 2 === 0 ? "primaria" : "acento"),
        apagado_em: null,
      },
      tz,
    );
    if (!existente) track("med_added", { schedule_type: tipo });
    mostrar(copy.salvo);
    router.push("/medicamentos");
  }

  function mudarHora(i: number, v: string) {
    setTimes((l) => l.map((h, j) => (j === i ? v : h)));
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-8 pt-1">
      <Card tom="suave">
        <p className="tipo-corpo text-primaria-texto">{copy.aviso}</p>
      </Card>

      <div className="relative">
        <CampoTexto
          rotulo={copy.nome}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocoNome(true)}
          onBlur={() => window.setTimeout(() => setFocoNome(false), 150)}
          erro={tocou ? erroNome : undefined}
          autoComplete="off"
          role="combobox"
          aria-expanded={sugestoes.length > 0}
          aria-controls="sugestoes-nome"
        />
        {sugestoes.length > 0 && (
          <ul id="sugestoes-nome" role="listbox" aria-label={copy.nome} className="absolute inset-x-0 z-10 mt-1 overflow-hidden rounded-card border border-fio bg-superficie">
            {sugestoes.map((s) => (
              <li key={s} role="option" aria-selected={false}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setName(s); setFocoNome(false); }} className="flex min-h-11 w-full items-center px-4 text-left text-[15px] text-texto active:bg-primaria-suave">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CampoTexto rotulo={copy.dose} placeholder={copy.dosePlaceholder} value={dose} maxLength={40} onChange={(e) => setDose(e.target.value)} autoComplete="off" />
      <CampoTexto rotulo={copy.orientacao} placeholder={copy.orientacaoPlaceholder} value={instructions} maxLength={120} onChange={(e) => setInstructions(e.target.value)} autoComplete="off" />

      <Escolha rotulo={copy.frequencia} opcoes={TIPOS.map((t) => ({ valor: t, rotulo: copy.tipos[t] }))} valor={tipo} onMudar={setTipo} />

      {tipo === "weekdays" && (
        <div>
          <Escolha
            rotulo={copy.dias}
            opcoes={copy.diasSemana.map((d, i) => ({ valor: i, rotulo: d }))}
            valor={weekdays}
            onMudar={(d) => setWeekdays((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d].sort((a, b) => a - b)))}
          />
          {tocou && erroAgenda === "dias" && <p className="mt-1.5 text-[12px] text-erro">{copy.diasErro}</p>}
        </div>
      )}

      {(tipo === "fixed_times" || tipo === "weekdays") && (
        <fieldset>
          <legend className="tipo-titulo-secao mb-1.5 text-texto-mudo">{copy.horarios}</legend>
          <div className="flex flex-col gap-2">
            {times.map((h, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <CampoTexto rotulo={`${copy.horarios} ${i + 1}`} id={`horario-${i}`} type="time" value={h} onChange={(e) => mudarHora(i, e.target.value)} />
                </div>
                {times.length > 1 && (
                  <button type="button" aria-label={copy.removerHorario(h)} onClick={() => setTimes((l) => l.filter((_, j) => j !== i))} className="grid size-13 place-items-center rounded-pilula text-texto-mudo active:bg-primaria-suave">
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
            {times.length < 4 && (
              <Botao variant="fantasma" icone={<Plus size={16} aria-hidden />} onClick={() => setTimes((l) => [...l, "20:00"])}>
                {copy.adicionarHorario}
              </Botao>
            )}
          </div>
          {tocou && erroAgenda === "horarios" && <p className="mt-1.5 text-[12px] text-erro">{copy.horariosErro}</p>}
        </fieldset>
      )}

      {tipo === "interval" && (
        <>
          <Escolha rotulo={copy.aCada} opcoes={INTERVALOS.map((n) => ({ valor: n, rotulo: copy.horas(n) }))} valor={intervalo} onMudar={setIntervalo} />
          <CampoTexto rotulo={copy.primeiraDose} type="time" value={ancora} onChange={(e) => setAncora(e.target.value)} />
        </>
      )}

      {tipo === "as_needed" && <p className="tipo-meta">{copy.semLembreteNecessario}</p>}

      <div className="grid grid-cols-2 gap-3">
        <CampoTexto rotulo={copy.inicio} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        <CampoTexto rotulo={copy.fim} type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} erro={tocou && erroAgenda === "fim" ? copy.fimErro : undefined} />
      </div>

      {tipo !== "as_needed" && (
        <Card compacto>
          <Interruptor rotulo={copy.lembrete} apoio={copy.lembreteApoio} ligado={lembrete} onMudar={setLembrete} />
        </Card>
      )}

      <Botao largura="total" tamanho="lg" onClick={() => salvar()}>
        {copy.salvar}
      </Botao>

      {existente && (
        <div className="flex gap-2">
          {existente.is_active ? (
            <Botao
              largura="total"
              variant="secundario"
              onClick={() => {
                salvarMedicamento({ ...existente, is_active: false }, tz);
                mostrar(copy.arquivado);
                router.push("/medicamentos/lista");
              }}
            >
              {copy.arquivar}
            </Botao>
          ) : (
            <Botao largura="total" variant="secundario" onClick={() => salvar(true)}>
              {copy.reativar}
            </Botao>
          )}
          <Botao largura="total" variant="fantasma" onClick={() => setApagando(true)}>
            {copy.apagar}
          </Botao>
        </div>
      )}

      <SheetPaywall aberto={paywall} gatilho={{ feature: "medications", trigger: "active_limit" }} onFechar={() => setPaywall(false)} />
      <SheetConfirmar
        aberto={apagando}
        titulo={copy.apagar}
        texto={copy.apagarConfirma}
        confirmar={copy.apagar}
        cancelar={copy.cancelar}
        onFechar={() => setApagando(false)}
        onConfirmar={() => {
          if (!existente) return;
          apagarMedicamento(existente, tz);
          mostrar(copy.apagado);
          router.push("/medicamentos/lista");
        }}
      />
    </div>
  );
}
