
interface CalendarFeed {
  id: string;
  name: string;
  url: string;
  color: string;
  enabled: boolean;
  lastSync?: string;
  eventCount?: number;
  // Number of times per day to sync automatically (0/undefined = manual only)
  syncFrequencyPerDay?: number;
}

class CalendarStorageService {
  private dbName = 'FamilyCalendarDB';
  private dbVersion = 2;
  private storeName = 'calendar_feeds';
  private syncQueueStore = 'sync_queue';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('url', 'url', { unique: false });
        }
        if (!db.objectStoreNames.contains(this.syncQueueStore)) {
          db.createObjectStore(this.syncQueueStore, { autoIncrement: true });
        }
      };
    });
  }

  async addCalendar(calendar: CalendarFeed): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(calendar);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async updateCalendar(id: string, updates: Partial<CalendarFeed>): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(id);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const calendar = getRequest.result;
        if (calendar) {
          const updatedCalendar = { ...calendar, ...updates };
          const putRequest = store.put(updatedCalendar);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => resolve();
        } else {
          reject(new Error('Calendar not found'));
        }
      };
    });
  }

  async deleteCalendar(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllCalendars(): Promise<CalendarFeed[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getCalendar(id: string): Promise<CalendarFeed | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /** Drain items queued by the service worker; used for background iCal sync handoff. */
  async drainBackgroundSyncQueue(): Promise<unknown[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.syncQueueStore], 'readwrite');
      const store = transaction.objectStore(this.syncQueueStore);
      const getAllRequest = store.getAll();

      getAllRequest.onerror = () => reject(getAllRequest.error);
      getAllRequest.onsuccess = () => {
        const items = getAllRequest.result || [];
        if (items.length === 0) {
          resolve([]);
          return;
        }
        const clearRequest = store.clear();
        clearRequest.onerror = () => reject(clearRequest.error);
        clearRequest.onsuccess = () => resolve(items);
      };
    });
  }
}

export const calendarStorageService = new CalendarStorageService();
export type { CalendarFeed };
