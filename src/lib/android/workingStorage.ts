const DB_NAME = 'epp-working-storage';
const STORE_NAME = 'images';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise == null) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = run(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** IndexedDB-backed working storage for image bytes -- the Android counterpart to Electron's
 * session-scoped working directory (see design.md, Decision 3a). Every ingested/extracted image's
 * bytes are stored as a Blob keyed by assetId; an ImageAsset's `storedPath` on Android is that
 * assetId, an opaque identifier per the `platform-adapter` capability's existing rule. */
export const workingStorage = {
  async put(assetId: string, blob: Blob): Promise<void> {
    await withStore('readwrite', (store) => store.put(blob, assetId));
  },

  async get(assetId: string): Promise<Blob | null> {
    const result = await withStore<Blob | undefined>('readonly', (store) => store.get(assetId));
    return result ?? null;
  },

  remove(assetId: string): Promise<void> {
    return withStore('readwrite', (store) => store.delete(assetId));
  },

  async clear(): Promise<void> {
    await withStore('readwrite', (store) => store.clear());
  },
};
