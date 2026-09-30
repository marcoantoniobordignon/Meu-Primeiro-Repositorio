import { useSyncExternalStore } from "react";

/**
 * Coleção local (localStorage) com o formato de registro da spec 01:
 * id gerado no cliente, atualizado_em para resolver conflito, apagado_em para
 * soft delete. Toda escrita avisa os ganchos (a outbox se registra ali) e
 * `mesclar` aplica o que veio do servidor sem duplicar (ARQ-02).
 */
export interface Registro {
  id: string;
  atualizado_em: string;
  apagado_em?: string | null;
  criado_por?: string;
}

export function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface Colecao<T extends Registro> {
  chave: string;
  /** Registros vivos (sem apagado_em). */
  listar(): T[];
  listarTodos(): T[];
  obter(id: string): T | undefined;
  salvar(item: Omit<T, "atualizado_em"> & Partial<Pick<T, "atualizado_em">>): T;
  apagar(id: string): void;
  limpar(): void;
  assinar(cb: () => void): () => void;
  /** ARQ-02: aplica registros do servidor; vence o maior atualizado_em. Retorna quantos mudaram. */
  mesclar(doServidor: T[]): number;
}

type GanchoEscrita = (colecao: string, registro: Registro) => void;
const ganchos = new Set<GanchoEscrita>();

/** A outbox usa isto para enfileirar toda escrita local (nunca as vindas do servidor). */
export function aoEscrever(cb: GanchoEscrita): () => void {
  ganchos.add(cb);
  return () => ganchos.delete(cb);
}

const VAZIO: never[] = [];

export function criarColecao<T extends Registro>(chave: string): Colecao<T> {
  let cache: T[] | null = null;
  let vivos: T[] | null = null;
  const ouvintes = new Set<() => void>();

  function ler(): T[] {
    if (cache) return cache;
    try {
      const bruto = typeof localStorage === "undefined" ? null : localStorage.getItem(chave);
      cache = bruto ? (JSON.parse(bruto) as T[]) : [];
    } catch {
      cache = [];
    }
    vivos = null;
    return cache;
  }

  function escrever(itens: T[]) {
    cache = itens;
    vivos = null;
    try {
      localStorage.setItem(chave, JSON.stringify(itens));
    } catch {
      /* storage indisponível: segue em memória */
    }
    ouvintes.forEach((cb) => cb());
  }

  function substituir(itens: T[], novo: T): T[] {
    const i = itens.findIndex((r) => r.id === novo.id);
    return i >= 0 ? itens.map((r, j) => (j === i ? novo : r)) : [...itens, novo];
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === chave) {
        cache = null;
        vivos = null;
        ouvintes.forEach((cb) => cb());
      }
    });
  }

  return {
    chave,
    listar() {
      if (!vivos) vivos = ler().filter((r) => !r.apagado_em);
      return vivos.length ? vivos : (VAZIO as T[]);
    },
    listarTodos: ler,
    obter(id) {
      return ler().find((r) => r.id === id);
    },
    salvar(item) {
      const agora = new Date().toISOString();
      const novo = { ...item, atualizado_em: agora } as T;
      escrever(substituir(ler(), novo));
      ganchos.forEach((g) => g(chave, novo));
      return novo;
    },
    apagar(id) {
      const agora = new Date().toISOString();
      const atual = ler().find((r) => r.id === id);
      if (!atual) return;
      const novo = { ...atual, apagado_em: agora, atualizado_em: agora };
      escrever(substituir(ler(), novo));
      ganchos.forEach((g) => g(chave, novo));
    },
    limpar() {
      escrever([]);
    },
    assinar(cb) {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    mesclar(doServidor) {
      let itens = ler();
      let mudou = 0;
      for (const remoto of doServidor) {
        const local = itens.find((r) => r.id === remoto.id);
        if (!local || remoto.atualizado_em > local.atualizado_em) {
          itens = substituir(itens, remoto);
          mudou++;
        }
      }
      if (mudou) escrever(itens);
      return mudou;
    },
  };
}

/** Lê uma coleção de forma reativa: a tela re-renderiza quando algo muda. */
export function useColecao<T extends Registro>(colecao: Colecao<T>): T[] {
  return useSyncExternalStore(colecao.assinar, colecao.listar, () => VAZIO as T[]);
}
