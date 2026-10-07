/**
 * IndexedDB mínimo para a outbox (ARQ-01), os arquivos e as ações do push. Sem dependência; cai em memória
 * quando o IndexedDB não existe (testes, Safari em modo privado).
 */
const NOME = "ninho";
const VERSAO = 2;
export const STORE_OUTBOX = "outbox";
/** Fotos e áudios do aparelho: o blob fica aqui até subir para o Storage (e depois, como cache). */
export const STORE_ARQUIVOS = "arquivos";
/** Arquivos apagados aqui que ainda precisam sair do Storage. */
export const STORE_REMOCOES = "remocoes";
/** Ações tocadas na notificação ("Tomei", "Adiar") com o app fechado; o service worker grava, o app aplica. */
export const STORE_ACOES_PUSH = "acoes_push";
const STORES = [STORE_OUTBOX, STORE_ARQUIVOS, STORE_REMOCOES, STORE_ACOES_PUSH];

let db: Promise<IDBDatabase | null> | null = null;
const memoria = new Map<string, Map<string, unknown>>();

function abrir(): Promise<IDBDatabase | null> {
  if (db) return db;
  db = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(NOME, VERSAO);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const store of STORES) if (!d.objectStoreNames.contains(store)) d.createObjectStore(store, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return db;
}

function mem(store: string) {
  let m = memoria.get(store);
  if (!m) {
    m = new Map();
    memoria.set(store, m);
  }
  return m;
}

function pedir<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbTodos<T extends { id: string }>(store: string): Promise<T[]> {
  const d = await abrir();
  if (!d) return [...mem(store).values()] as T[];
  const tx = d.transaction(store, "readonly");
  return pedir(tx.objectStore(store).getAll()) as Promise<T[]>;
}

export async function idbSalvar<T extends { id: string }>(store: string, item: T): Promise<void> {
  const d = await abrir();
  if (!d) {
    mem(store).set(item.id, item);
    return;
  }
  const tx = d.transaction(store, "readwrite");
  await pedir(tx.objectStore(store).put(item));
}

export async function idbObter<T extends { id: string }>(store: string, id: string): Promise<T | undefined> {
  const d = await abrir();
  if (!d) return mem(store).get(id) as T | undefined;
  const tx = d.transaction(store, "readonly");
  return (await pedir(tx.objectStore(store).get(id))) as T | undefined;
}

export async function idbApagar(store: string, id: string): Promise<void> {
  const d = await abrir();
  if (!d) {
    mem(store).delete(id);
    return;
  }
  const tx = d.transaction(store, "readwrite");
  await pedir(tx.objectStore(store).delete(id));
}

export async function idbLimpar(store: string): Promise<void> {
  const d = await abrir();
  if (!d) {
    mem(store).clear();
    return;
  }
  const tx = d.transaction(store, "readwrite");
  await pedir(tx.objectStore(store).clear());
}
