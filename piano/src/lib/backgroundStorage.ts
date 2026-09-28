'use client';

const DB_NAME = 'synthesia_assets_db';
const STORE_NAME = 'settings_media';
const BG_KEY = 'custom_background_image';

/**
 * Safely saves a custom background image data string into IndexedDB
 */
export async function saveCustomBackgroundToDB(dataUrl: string): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(dataUrl, BG_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Safely loads the custom background image data string from IndexedDB
 */
export async function loadCustomBackgroundFromDB(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  return new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(BG_KEY);
        getReq.onsuccess = () => {
          resolve((getReq.result as string) || null);
        };
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Removes the custom background image from IndexedDB
 */
export async function removeCustomBackgroundFromDB(): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  return new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(BG_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Compresses/resizes an uploaded image file before storing if oversized
 */
export function compressImageFile(file: File, maxDim = 2560, quality = 0.88): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      if (!result) return reject(new Error('Failed to read file'));

      // Keep GIF or SVG or small images untouched
      if (file.type === 'image/svg+xml' || file.type === 'image/gif' || file.size < 750 * 1024) {
        return resolve(result);
      }

      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(result);
        }
        ctx.drawImage(img, 0, 0, width, height);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const compressed = canvas.toDataURL(mime, quality);
        resolve(compressed);
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}
