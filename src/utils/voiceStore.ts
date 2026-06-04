/**
 * IndexedDB-backed storage for voice-note audio blobs.
 *
 * Voice notes used to live in localStorage as base64 strings, which is capped
 * at ~5 MB and silently drops data once full. IndexedDB stores real Blobs with
 * a far larger quota, so notes persist reliably across reloads.
 */

const DB_NAME = 'salesPlanner'
const STORE = 'voiceNotes'
const VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putVoiceNote(id: string, blob: Blob): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function deleteVoiceNote(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** All stored voice notes as a map of visitId → Blob. */
export async function getAllVoiceNotes(): Promise<Record<string, Blob>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const out: Record<string, Blob> = {}
    const tx = db.transaction(STORE, 'readonly')
    const cursorReq = tx.objectStore(STORE).openCursor()
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (cursor) {
        out[String(cursor.key)] = cursor.value as Blob
        cursor.continue()
      }
    }
    tx.oncomplete = () => { db.close(); resolve(out) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
