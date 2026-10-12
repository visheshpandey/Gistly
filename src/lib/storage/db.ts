// A small wrapper around IndexedDB, the browser's large database.
//
// Why not localStorage: it holds only about 5 MB for the whole site, which is too little for several datasets
// and their analyses. IndexedDB holds hundreds of MB. If a browser blocks it (some private windows do), everything
// still works but is kept in memory for this visit, and persistenceMode() says so, so the page can warn the user.
//
// This file has no framework code, so tests can run it in Node, where it uses the memory fallback.

export type StoreName = "meta" | "datasets" | "analyses" | "adaption" | "ask";
export type Persistence = "indexeddb" | "memory";

const DB_NAME = "insightflow";
const DB_VERSION = 1;
export const STORE_NAMES: StoreName[] = ["meta", "datasets", "analyses", "adaption", "ask"];

const memory = new Map<StoreName, Map<string, unknown>>(STORE_NAMES.map((s) => [s, new Map()]));
let dbPromise: Promise<IDBDatabase | null> | null = null;
let mode: Persistence = "indexeddb";

function open(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const fail = () => {
        mode = "memory";
        resolve(null);
      };
      if (typeof indexedDB === "undefined") {
        fail();
        return;
      }
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          for (const name of STORE_NAMES) {
            if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = fail;
        request.onblocked = fail;
      } catch {
        fail();
      }
    });
  }
  return dbPromise;
}

// Which kind of storage is really in use. Call after the first read or write.
export async function persistenceMode(): Promise<Persistence> {
  await open();
  return mode;
}

// Runs one request inside its own transaction and resolves only when the browser has finished saving it.
function run<T>(db: IDBDatabase, store: StoreName, access: IDBTransactionMode, make: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, access);
    const request = make(tx.objectStore(store));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error ?? request.error ?? new Error("The browser could not save this."));
    tx.onabort = () => reject(tx.error ?? new Error("The browser stopped saving. Its storage may be full."));
  });
}

export async function getItem<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return memory.get(store)?.get(key) as T | undefined;
  return (await run<T | undefined>(db, store, "readonly", (s) => s.get(key))) ?? undefined;
}

// Rejects if the browser cannot save (for example when its storage is full), so the caller can tell the user.
export async function putItem(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await open();
  if (!db) {
    memory.get(store)?.set(key, value);
    return;
  }
  await run(db, store, "readwrite", (s) => s.put(value, key));
}

export async function deleteItem(store: StoreName, key: string): Promise<void> {
  const db = await open();
  if (!db) {
    memory.get(store)?.delete(key);
    return;
  }
  await run(db, store, "readwrite", (s) => s.delete(key));
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await open();
  if (!db) return [...(memory.get(store)?.values() ?? [])] as T[];
  return (await run<T[]>(db, store, "readonly", (s) => s.getAll())) ?? [];
}

export async function getKeys(store: StoreName): Promise<string[]> {
  const db = await open();
  if (!db) return [...(memory.get(store)?.keys() ?? [])];
  return ((await run<IDBValidKey[]>(db, store, "readonly", (s) => s.getAllKeys())) ?? []).map(String);
}

// Only for tests: forget everything held in memory.
export function resetMemoryForTests(): void {
  for (const s of memory.values()) s.clear();
}
