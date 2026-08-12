
import { NotionScrapedEvent, NotionScrapedCalendar } from '@/types/notion';

const DB_NAME = 'NotionScrapedEventsDB';
const DB_VERSION = 3; // Increment version for new schema (added syncFrequencyPerDay on calendars)
const CALENDARS_STORE = 'calendars';
const EVENTS_STORE = 'events';

class NotionScrapedEventsStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create calendars store if it doesn't exist
        if (!db.objectStoreNames.contains(CALENDARS_STORE)) {
          const calendarsStore = db.createObjectStore(CALENDARS_STORE, { keyPath: 'id' });
          calendarsStore.createIndex('enabled', 'enabled', { unique: false });
          calendarsStore.createIndex('syncFrequencyPerDay', 'syncFrequencyPerDay', { unique: false });
        } else {
          // Upgrade existing calendar store with new index if missing
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const calendarsStore = transaction.objectStore(CALENDARS_STORE);
            try {
              if (!calendarsStore.indexNames.contains('syncFrequencyPerDay')) {
                calendarsStore.createIndex('syncFrequencyPerDay', 'syncFrequencyPerDay', { unique: false });
              }
            } catch (e) {
              // ignore if already exists
            }
          }
        }

        // Create events store if it doesn't exist
        if (!db.objectStoreNames.contains(EVENTS_STORE)) {
          const eventsStore = db.createObjectStore(EVENTS_STORE, { keyPath: 'id' });
          eventsStore.createIndex('calendarId', 'calendarId', { unique: false });
          eventsStore.createIndex('date', 'date', { unique: false });
          
          // New indexes for enhanced properties
          eventsStore.createIndex('status', 'status', { unique: false });
          eventsStore.createIndex('categories', 'categories', { unique: false, multiEntry: true });
          eventsStore.createIndex('priority', 'priority', { unique: false });
        } else {
          // Handle existing events store - add new indexes if they don't exist
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const eventsStore = transaction.objectStore(EVENTS_STORE);
            
            // Add new indexes if they don't exist
            try {
              if (!eventsStore.indexNames.contains('status')) {
                eventsStore.createIndex('status', 'status', { unique: false });
              }
              if (!eventsStore.indexNames.contains('categories')) {
                eventsStore.createIndex('categories', 'categories', { unique: false, multiEntry: true });
              }
              if (!eventsStore.indexNames.contains('priority')) {
                eventsStore.createIndex('priority', 'priority', { unique: false });
              }
            } catch (error) {
              console.warn('Indexes may already exist');
            }
          }
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // Calendar management methods
  async addCalendar(calendar: NotionScrapedCalendar): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CALENDARS_STORE], 'readwrite');
      const store = transaction.objectStore(CALENDARS_STORE);
      const request = store.add(calendar);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateCalendar(id: string, updates: Partial<NotionScrapedCalendar>): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CALENDARS_STORE], 'readwrite');
      const store = transaction.objectStore(CALENDARS_STORE);
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const existingCalendar = getRequest.result;
        if (existingCalendar) {
          const updatedCalendar = { ...existingCalendar, ...updates };
          const putRequest = store.put(updatedCalendar);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Calendar not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteCalendar(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CALENDARS_STORE, EVENTS_STORE], 'readwrite');
      
      // Delete calendar
      const calendarsStore = transaction.objectStore(CALENDARS_STORE);
      calendarsStore.delete(id);
      
      // Delete associated events
      const eventsStore = transaction.objectStore(EVENTS_STORE);
      const index = eventsStore.index('calendarId');
      const request = index.openCursor(IDBKeyRange.only(id));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllCalendars(): Promise<NotionScrapedCalendar[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CALENDARS_STORE], 'readonly');
      const store = transaction.objectStore(CALENDARS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async replaceAllCalendars(calendars: NotionScrapedCalendar[]): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CALENDARS_STORE, EVENTS_STORE], 'readwrite');
      const calendarsStore = transaction.objectStore(CALENDARS_STORE);

      calendarsStore.clear();
      transaction.objectStore(EVENTS_STORE).clear();
      calendars.forEach(calendar => calendarsStore.put(calendar));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Enhanced event management methods
  async saveEvents(calendarId: string, events: NotionScrapedEvent[]): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EVENTS_STORE], 'readwrite');
      const store = transaction.objectStore(EVENTS_STORE);
      
      // Clear existing events for this calendar
      const index = store.index('calendarId');
      const deleteRequest = index.openCursor(IDBKeyRange.only(calendarId));
      
      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Add new events
          events.forEach(event => {
            // Ensure event has calendarId
            event.calendarId = calendarId;
            
            // Convert date strings to Date objects if needed
            if (typeof event.date === 'string') {
              event.date = new Date(event.date);
            }
            if (event.dateRange?.startDate && typeof event.dateRange.startDate === 'string') {
              event.dateRange.startDate = new Date(event.dateRange.startDate);
            }
            if (event.dateRange?.endDate && typeof event.dateRange.endDate === 'string') {
              event.dateRange.endDate = new Date(event.dateRange.endDate);
            }
            if (typeof event.scrapedAt === 'string') {
              event.scrapedAt = new Date(event.scrapedAt);
            }
            
            store.add(event);
          });
        }
      };
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllEvents(): Promise<NotionScrapedEvent[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EVENTS_STORE], 'readonly');
      const store = transaction.objectStore(EVENTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const events = request.result || [];
        // Convert date strings back to Date objects
        const processedEvents = events.map(event => ({
          ...event,
          date: typeof event.date === 'string' ? new Date(event.date) : event.date,
          scrapedAt: typeof event.scrapedAt === 'string' ? new Date(event.scrapedAt) : event.scrapedAt,
          dateRange: event.dateRange ? {
            startDate: typeof event.dateRange.startDate === 'string' ? new Date(event.dateRange.startDate) : event.dateRange.startDate,
            endDate: event.dateRange.endDate ? (typeof event.dateRange.endDate === 'string' ? new Date(event.dateRange.endDate) : event.dateRange.endDate) : undefined
          } : undefined
        }));
        resolve(processedEvents);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getEventsByCalendar(calendarId: string): Promise<NotionScrapedEvent[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EVENTS_STORE], 'readonly');
      const store = transaction.objectStore(EVENTS_STORE);
      const index = store.index('calendarId');
      const request = index.getAll(calendarId);

      request.onsuccess = () => {
        const events = request.result || [];
        // Convert date strings back to Date objects
        const processedEvents = events.map(event => ({
          ...event,
          date: typeof event.date === 'string' ? new Date(event.date) : event.date,
          scrapedAt: typeof event.scrapedAt === 'string' ? new Date(event.scrapedAt) : event.scrapedAt
        }));
        resolve(processedEvents);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // New methods for enhanced querying
  async getEventsByStatus(status: string): Promise<NotionScrapedEvent[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EVENTS_STORE], 'readonly');
      const store = transaction.objectStore(EVENTS_STORE);
      const index = store.index('status');
      const request = index.getAll(status);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getEventsByCategory(category: string): Promise<NotionScrapedEvent[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EVENTS_STORE], 'readonly');
      const store = transaction.objectStore(EVENTS_STORE);
      const index = store.index('categories');
      const request = index.getAll(category);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getEventsByPriority(priority: string): Promise<NotionScrapedEvent[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EVENTS_STORE], 'readonly');
      const store = transaction.objectStore(EVENTS_STORE);
      const index = store.index('priority');
      const request = index.getAll(priority);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CALENDARS_STORE, EVENTS_STORE], 'readwrite');
      
      transaction.objectStore(CALENDARS_STORE).clear();
      transaction.objectStore(EVENTS_STORE).clear();
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const notionScrapedEventsStorage = new NotionScrapedEventsStorage();
export type { NotionScrapedCalendar };
