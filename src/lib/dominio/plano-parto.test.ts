import { describe, expect, it } from "vitest";

import { planejar } from "@dominio/lembretes.ts";
import {
  cabecalhoDoPdf,
  concluirEtapa,
  idDoPlano,
  itensDaLista,
  itensSemente,
  LIMITE_ANEXOS_FREE,
  linkTel,
  listaCompleta,
  lembretesDoPlano,
  mostrarQualMaternidade,
  ondeVazia,
  planoVazio,
  podeAnexar,
  progressoDaLista,
  progressoDoPlano,
  proximaPosicao,
  secoesDoPdf,
  SEMENTES,
  type ItemLista,
  type PlanoParto,
} from "@dominio/plano-parto.ts";
import { inicioDaSemana, instanteLocal } from "@dominio/tempo.ts";

const TZ = "America/Sao_Paulo";
const DPP = "2027-03-08";

describe("PLA RN-06 · sementes e listas", () => {
  const itens = itensSemente("mae-1");

  it("as 5 listas da spec, com a contagem da semente", () => {
    expect(Object.fromEntries(Object.entries(SEMENTES).map(([k, v]) => [k, v.length]))).toEqual({ documents: 8, bag_mother: 12, bag_baby: 10, bag_companion: 6, layette: 20 });
    expect(itens).toHaveLength(56);
    expect(itensDaLista(itens, "bag_baby").at(-1)?.title).toBe("Cadeirinha para o carro (obrigatória)");
  });

  it("ids determinísticos: dois aparelhos não duplicam; outra gestação, outros ids", () => {
    expect(itensSemente("mae-1").map((i) => i.id)).toEqual(itens.map((i) => i.id));
    expect(new Set(itens.map((i) => i.id)).size).toBe(56);
    expect(itensSemente("mae-2")[0]!.id).not.toBe(itens[0]!.id);
    expect(idDoPlano("mae-1")).toBe(idDoPlano("mae-1"));
    expect(idDoPlano("mae-1")).not.toBe(idDoPlano("mae-2"));
  });

  it("progresso por lista = feitos / total; apagado não conta", () => {
    const l = itens.map((i) => (i.list === "bag_mother" && i.position <= 3 ? { ...i, is_done: true } : i));
    expect(progressoDaLista(l, "bag_mother")).toEqual({ feitos: 3, total: 12 });
    const semUm = l.map((i) => (i.list === "bag_mother" && !i.is_done && i.position === 12 ? { ...i, apagado_em: "x" } : i));
    expect(progressoDaLista(semUm, "bag_mother")).toEqual({ feitos: 3, total: 11 });
  });

  it("item novo entra no fim; lista inexistente conta como incompleta", () => {
    expect(proximaPosicao(itens, "bag_mother")).toBe(13);
    expect(proximaPosicao([], "baptism")).toBe(1);
    expect(listaCompleta([], ["documents"])).toBe(false);
    expect(listaCompleta(itens.map((i) => ({ ...i, is_done: true })), ["documents", "bag_baby"])).toBe(true);
  });
});

describe("PLA RN-01 · etapas", () => {
  it("concluir não exige campos; idempotente e ordenado; só 1 a 5", () => {
    expect(concluirEtapa([], 3)).toEqual([3]);
    expect(concluirEtapa([3, 1], 3)).toEqual([1, 3]);
    expect(concluirEtapa([9, 2], 1)).toEqual([1, 2]);
    expect(progressoDoPlano([1, 3])).toEqual({ feitas: 2, total: 5 });
    expect(progressoDoPlano([1, 1, 7])).toEqual({ feitas: 1, total: 5 });
  });
});

describe("PLA RN-08/11 · maternidade", () => {
  const p = (x: Partial<PlanoParto> = {}): PlanoParto => ({ ...planoVazio("p"), ...x });
  it("'Onde' vazia sem nome, endereço nem telefone", () => {
    expect(ondeVazia(null)).toBe(true);
    expect(ondeVazia(p({ maternity_name: "  " }))).toBe(true);
    expect(ondeVazia(p({ maternity_phone: "11 3333-4444" }))).toBe(false);
  });
  it("'Qual maternidade?' na semana 37 ou depois, só se faltar", () => {
    expect(mostrarQualMaternidade(36, null)).toBe(false);
    expect(mostrarQualMaternidade(37, null)).toBe(true);
    expect(mostrarQualMaternidade(39, p({ maternity_name: "Pro Matre" }))).toBe(false);
    expect(mostrarQualMaternidade(null, null)).toBe(false);
  });
  it("tel: com o número cadastrado", () => {
    expect(linkTel("(11) 3333-4444")).toBe("tel:1133334444");
    expect(linkTel("+55 11 3333-4444")).toBe("tel:+551133334444");
    expect(linkTel("")).toBeNull();
    expect(linkTel(null)).toBeNull();
  });
});

describe("PLA RN-09 · anexos", () => {
  it("até 3 por item; free 10 no total; premium sem limite", () => {
    expect(podeAnexar(2, 5, false)).toBe("ok");
    expect(podeAnexar(3, 5, false)).toBe("item_cheio");
    expect(podeAnexar(0, LIMITE_ANEXOS_FREE, false)).toBe("limite_free");
    expect(podeAnexar(0, 40, true)).toBe("ok");
    expect(podeAnexar(3, 40, true)).toBe("item_cheio");
  });
});

describe("PLA RN-07 · lembretes nas semanas 28, 34 e 36 às 10h", () => {
  const sementes = itensSemente("m");
  const feito = (l: ItemLista[], listas: string[]) => l.map((i) => (listas.includes(i.list) ? { ...i, is_done: true } : i));

  it("semana 28 'Hora de começar', às 10:00 do primeiro dia da semana", () => {
    const [l] = lembretesDoPlano({ dpp: DPP, tz: TZ, plano: null, itens: [] });
    expect(l).toMatchObject({ categoria: "birth_plan", tipo: "birth_plan_nudge", titulo: "Hora de começar o plano de parto", url: "/plano-parto?origem=lembrete&categoria=birth_plan&semana=28" });
    expect(l!.em.toISOString()).toBe(instanteLocal(inicioDaSemana(DPP, 28), "10:00", TZ).toISOString());
  });

  it("semana 34 só com a mala incompleta; 36 só com documentos incompletos", () => {
    const tipos = (itens: ItemLista[]) => lembretesDoPlano({ dpp: DPP, tz: TZ, plano: planoVazio("p"), itens }).map((l) => l.ref);
    expect(tipos(sementes)).toEqual(["semana-28", "semana-34", "semana-36"]);
    expect(tipos(feito(sementes, ["bag_mother", "bag_baby", "bag_companion"]))).toEqual(["semana-28", "semana-36"]);
    expect(tipos(feito(sementes, ["bag_mother", "bag_baby", "bag_companion", "documents"]))).toEqual(["semana-28"]);
  });

  it("plano com as 5 etapas concluídas não recebe lembretes; sem DPP também não", () => {
    expect(lembretesDoPlano({ dpp: DPP, tz: TZ, plano: { ...planoVazio("p"), completed_steps: [1, 2, 3, 4, 5] }, itens: [] })).toEqual([]);
    expect(lembretesDoPlano({ dpp: null, tz: TZ, plano: null, itens: [] })).toEqual([]);
  });

  it("entra no planejador comum", () => {
    const l = planejar({ agora: new Date(), tz: TZ, dpp: DPP, criadaEm: "2026-01-01", prefs: null, medicamentos: [], doses: [], exames: [], consultas: [], perguntas: [], semanasComFoto: [], marcos: { respondidos: [], estados: [] }, plano: { plano: null, itens: [] } });
    expect(l.filter((x) => x.categoria === "birth_plan").map((x) => x.ref)).toEqual(["semana-28", "semana-34", "semana-36"]);
  });
});

describe("PLA RN-02/05 · conteúdo do PDF", () => {
  it("plano vazio: nenhuma seção (o PDF nunca exige campos)", () => {
    expect(secoesDoPdf(planoVazio("p"))).toEqual([]);
  });

  it("maternidade, equipe, acompanhantes, preferências marcadas e observações; vazias somem", () => {
    const s = secoesDoPdf({
      ...planoVazio("p"),
      maternity_name: "Maternidade Sol",
      maternity_phone: "11 3333-4444",
      coverage: "private",
      insurer_name: "Saúde Mais",
      doctor_name: "Dra. Ana",
      companion_name: "Rafa",
      companion_phone: "11 9999-0000",
      wished_delivery: "vaginal",
      prefs: { analgesia: "epidural", skin_to_skin: true, free_movement: true, delayed_cord_clamping: false, photos_video: "allowed" },
      notes: "Música calma",
    });
    expect(s.map((x) => x.titulo)).toEqual(["Maternidade", "Equipe", "Acompanhantes", "Preferências (desejos, não garantias)", "Observações"]);
    expect(s[0]!.linhas).toEqual(["Maternidade Sol", "Telefone: 11 3333-4444", "Plano de saúde · Saúde Mais"]);
    expect(s[3]!.linhas).toEqual(["[x] Parto normal", "[x] Com analgesia (peridural)", "[x] Contato pele a pele logo após o nascimento", "[x] Liberdade para se movimentar", "[x] Fotos e vídeo permitidos"]);
    expect(s[3]!.linhas.join(" ")).not.toContain("Clampeamento");
  });

  it("cabeçalho com nome, DPP e semana", () => {
    const c = cabecalhoDoPdf({ nome: "Helena", dpp: DPP, agora: new Date("2026-10-07T15:00:00Z"), tz: TZ, formatar: (d) => d.split("-").reverse().join("/") });
    expect(c).toEqual(["Nome: Helena", "Data provável do parto: 08/03/2027", "Semana: 18"]);
    expect(cabecalhoDoPdf({ nome: null, dpp: null, agora: new Date(), tz: TZ, formatar: (d) => d })).toEqual([]);
  });
});
