// Client-side-only session persistence for Abacus, via IndexedDB rather
// than localStorage. Generated images are base64 data URLs and a full
// batch can run several MB — localStorage's ~5-10MB per-origin quota is a
// real risk of silently failing to save the very thing (images) a refresh
// would otherwise lose. Deliberately not backed by Supabase/any server —
// this is a browser-only safety net, not a real persisted-video feature.
//
// Stored per-profile (keyed by profile id), not as one flat snapshot —
// each brand profile's in-progress script/images are independent work and
// must survive switching to another profile and back, the same way the
// server-side anti-repetition history is already scoped per profile_id.

const DB_NAME = "abacus-session-db";
const STORE_NAME = "session";
const DB_VERSION = 1;
const SESSION_KEY = "current";

export type PersistedSlot = {
  id: number;
  prompt: string;
  status: string;
  imageUrl?: string;
  error?: string;
};

export type ProfileSessionState = {
  topicSteer: string;
  scriptInfo: unknown;
  imagePrompts: unknown;
  translatedScript: unknown;
  languageCode: string;
  slots: PersistedSlot[];
};

export type AbacusSessionSnapshot = {
  activeProfileId: string;
  backend: string;
  profiles: Record<string, ProfileSessionState>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getSession(): Promise<AbacusSessionSnapshot | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(SESSION_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function putSession(snapshot: AbacusSessionSnapshot): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(snapshot, SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best-effort persistence — a write failure (quota, private browsing,
    // etc.) shouldn't break the app, just skip saving this snapshot.
  }
}

export async function clearSession(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}
