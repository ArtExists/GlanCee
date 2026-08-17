// IndexedDB storage service for caching the latest recorded session video blob
// Rule: Only one active cached recording at a time. Starting a new recording clears/overwrites the previous one.

import { RecordedSession } from '../types';

const DB_NAME = 'GlanceRecordingsDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';
const RECORDING_KEY = 'latest_session';

interface StoredRecordingRecord {
  id: string;
  blob: Blob;
  duration: number;
  size: number;
  timestamp: number;
  mimeType: string;
}

class RecordingStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private currentObjectUrl: string | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
          reject(new Error('IndexedDB is not supported in this browser.'));
          return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error || new Error('Failed to open IndexedDB.'));
        };
      });
    }
    return this.dbPromise;
  }

  /**
   * Save or overwrite the latest recorded session in IndexedDB
   */
  public async saveLatestRecording(blob: Blob, duration: number, mimeType: string): Promise<RecordedSession> {
    const db = await this.getDB();
    const id = 'rec_' + Date.now();
    const timestamp = Date.now();
    const size = blob.size;

    const record: StoredRecordingRecord = {
      id,
      blob,
      duration,
      size,
      timestamp,
      mimeType,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const putRequest = store.put(record, RECORDING_KEY);

      putRequest.onsuccess = () => {
        if (this.currentObjectUrl) {
          URL.revokeObjectURL(this.currentObjectUrl);
        }
        this.currentObjectUrl = URL.createObjectURL(blob);

        resolve({
          id,
          blob,
          url: this.currentObjectUrl,
          duration,
          size,
          timestamp,
          mimeType,
        });
      };

      putRequest.onerror = () => {
        reject(putRequest.error || new Error('Failed to save recording to IndexedDB.'));
      };
    });
  }

  /**
   * Retrieve the cached recording from IndexedDB if one exists
   */
  public async getLatestRecording(): Promise<RecordedSession | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(RECORDING_KEY);

        getRequest.onsuccess = () => {
          const record = getRequest.result as StoredRecordingRecord | undefined;
          if (!record || !record.blob) {
            resolve(null);
            return;
          }

          if (this.currentObjectUrl) {
            URL.revokeObjectURL(this.currentObjectUrl);
          }
          this.currentObjectUrl = URL.createObjectURL(record.blob);

          resolve({
            id: record.id,
            blob: record.blob,
            url: this.currentObjectUrl,
            duration: record.duration,
            size: record.size,
            timestamp: record.timestamp,
            mimeType: record.mimeType,
          });
        };

        getRequest.onerror = () => {
          reject(getRequest.error || new Error('Failed to retrieve recording from IndexedDB.'));
        };
      });
    } catch (err) {
      console.warn('Failed to load latest recording from IndexedDB:', err);
      return null;
    }
  }

  /**
   * Clear the cached recording from IndexedDB
   */
  public async clearLatestRecording(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const deleteRequest = store.delete(RECORDING_KEY);

        deleteRequest.onsuccess = () => {
          if (this.currentObjectUrl) {
            URL.revokeObjectURL(this.currentObjectUrl);
            this.currentObjectUrl = null;
          }
          resolve();
        };

        deleteRequest.onerror = () => {
          reject(deleteRequest.error || new Error('Failed to delete recording from IndexedDB.'));
        };
      });
    } catch (err) {
      console.warn('Failed to clear recording from IndexedDB:', err);
    }
  }
}

export const recordingStorage = new RecordingStorage();
