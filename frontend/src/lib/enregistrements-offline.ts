const DB_NAME = 'ogefmeeting-audio';
const STORE = 'pending_uploads';
const DB_VERSION = 1;

export type PendingAudioUpload = {
  id: string;
  reunionId: string;
  mimeType: string;
  dureeSecondes: number;
  blob: Blob;
  creeLe: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponible'));
  });
}

export async function sauvegarderUploadEnAttente(
  entry: PendingAudioUpload,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listerUploadsEnAttente(): Promise<PendingAudioUpload[]> {
  const db = await openDb();
  const items = await new Promise<PendingAudioUpload[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as PendingAudioUpload[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function supprimerUploadEnAttente(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
