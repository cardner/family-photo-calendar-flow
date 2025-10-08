/**
 * Enhanced Settings Storage Service
 * 
 * Implements a tiered storage system:
 * 1. In-memory cache (fastest)
 * 2. localStorage (fallback)
 * 3. IndexedDB (persistent fallback)
 */

import { secureStorage } from '@/utils/security/secureStorage';

interface SettingsItem {
  key: string;
  value: string;
  isSensitive: boolean;
  lastUpdated: number;
}

interface LoadedSettings {
  theme?: 'light' | 'dark' | 'system' | null;
  defaultView?: 'month' | 'week' | 'timeline' | null;
  keepScreenAwake?: string | null;
  backgroundDuration?: string | null;
  selectedAlbum?: string | null;
  coordinates?: string | null;
  publicAlbumUrl?: string | null;
  githubOwner?: string | null;
  githubRepo?: string | null;
  notionToken?: string | null;
  notionDatabaseId?: string | null;
  useManualLocation?: string | null;
  weatherProvider?: string | null;
}

class SettingsStorageService {
  private cache = new Map<string, SettingsItem>();
  private dbName = 'SettingsDB';
  private dbVersion = 1;
  private storeName = 'settings';
  private db: IDBDatabase | null = null;

  // Sensitive keys that should use secure storage
  private sensitiveKeys = new Set([
    'notionToken',
    'notion_token',
    'publicAlbumUrl',
    'githubOwner',
    'githubRepo',
    'coordinates',
    'notion_database_id',
    'notionDatabaseId'
  ]);

  /**
   * Initialize IndexedDB connection
   */
  private async initDB(): Promise<void> {
    if (this.db) return;
    if (typeof indexedDB === 'undefined') {
      this.db = null;
      return;
    }

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
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('isSensitive', 'isSensitive', { unique: false });
          store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }
      };
    });
  }

  /**
   * Check if a key is considered sensitive
   */
  private isSensitiveKey(key: string): boolean {
    return this.sensitiveKeys.has(key);
  }

  /**
   * Get value from cache first, then localStorage, then IndexedDB
   */
  async getValue(key: string): Promise<string | null> {
    try {
      // Environment guard: if localStorage is unavailable (SSR/test edge), skip
      if (typeof localStorage === 'undefined') {
        return null;
      }
      // 1. Check in-memory cache first
      const cached = this.cache.get(key);
      if (cached) {
        // debug removed: settings cache hit
        return cached.value;
      }

      // 2. Check localStorage
      const isSensitive = this.isSensitiveKey(key);
      let value: string | null = null;

      if (isSensitive && secureStorage.exists('test')) {
        try {
          value = await secureStorage.retrieve(key, 'defaultPassword');
          if (value) {
            // debug removed: loaded from secure storage
          }
        } catch (error) {
          console.warn(`Failed to load ${key} from secure storage:`, error);
        }
      }

      // Fallback to regular localStorage
      if (!value) {
        value = localStorage.getItem(key);
        if (value) {
          // debug removed: loaded from localStorage
        }
      }

      // 3. If not in localStorage, check IndexedDB
      if (!value) {
        value = await this.getFromIndexedDB(key);
        if (value) {
          // debug removed: loaded from IndexedDB
          // Populate localStorage with the value for faster future access
          if (isSensitive && secureStorage.exists('test')) {
            try {
              await secureStorage.store(key, value, 'defaultPassword');
            } catch (error) {
              localStorage.setItem(key, value);
            }
          } else {
            localStorage.setItem(key, value);
          }
        }
      }

      // Cache the value for future access
      if (value) {
        this.cache.set(key, {
          key,
          value,
          isSensitive,
          lastUpdated: Date.now()
        });
      }

      return value;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  /**
   * Save value to all storage layers
   */
  async setValue(key: string, value: string): Promise<void> {
    try {
      // Environment guard: if localStorage is unavailable, just cache and exit
      if (typeof localStorage === 'undefined') {
        const isSensitive = this.isSensitiveKey(key);
        this.cache.set(key, { key, value, isSensitive, lastUpdated: Date.now() });
        return;
      }
      const isSensitive = this.isSensitiveKey(key);
      const settingsItem: SettingsItem = {
        key,
        value,
        isSensitive,
        lastUpdated: Date.now()
      };

      // 1. Update cache immediately
  this.cache.set(key, settingsItem);
  // debug removed: settings cached

      // 2. Save to localStorage/secure storage
      if (isSensitive && secureStorage.exists('test')) {
        try {
          await secureStorage.store(key, value, 'defaultPassword');
          localStorage.removeItem(key); // Remove unencrypted version
          // debug removed: saved to secure storage
        } catch (error) {
          console.warn(`Failed to save ${key} securely, using localStorage:`, error);
          localStorage.setItem(key, value);
        }
      } else {
        localStorage.setItem(key, value);
        // debug removed: saved to localStorage
      }

      // 3. Save to IndexedDB for persistence
  await this.saveToIndexedDB(settingsItem);
  // debug removed: saved to IndexedDB

    } catch (error) {
      console.error(`Error saving setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Remove value from all storage layers
   */
  async removeValue(key: string): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') {
        this.cache.delete(key);
        return;
      }
      // Remove from cache
      this.cache.delete(key);

      // Remove from localStorage/secure storage
      const isSensitive = this.isSensitiveKey(key);
      if (isSensitive && secureStorage.exists('test')) {
        secureStorage.remove(key);
      }
      localStorage.removeItem(key);

      // Remove from IndexedDB
      await this.removeFromIndexedDB(key);

  // debug removed: settings removed
    } catch (error) {
      console.error(`Error removing setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Load all settings using the tiered approach
   */
  async loadAllSettings(): Promise<LoadedSettings> {
    try {
      const settingsKeys = [
        'theme', 'defaultView', 'keepScreenAwake', 'backgroundDuration', 'selectedAlbum',
        'coordinates', 'weatherProvider',
        'publicAlbumUrl', 'githubOwner', 'githubRepo', 
        'notionToken', 'notion_token', 'notionDatabaseId', 'notion_database_id',
        'useManualLocation'
      ];

      const settings: LoadedSettings = {};

      // Load each setting using the tiered approach
      for (const key of settingsKeys) {
        const value = await this.getValue(key);
        if (value !== null) {
          // Handle key mapping for backwards compatibility
          const mappedKey = key === 'notion_token' ? 'notionToken' : 
                           key === 'notion_database_id' ? 'notionDatabaseId' : key;
          (settings as Record<string, unknown>)[mappedKey] = value;
        }
      }

  // debug removed: all settings loaded
      return settings;
    } catch (error) {
      console.error('Error loading all settings:', error);
      return {};
    }
  }

  /**
   * Get value from IndexedDB
   */
  private async getFromIndexedDB(key: string): Promise<string | null> {
    try {
      await this.initDB();
      if (!this.db) return null;

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result as SettingsItem | undefined;
          resolve(result ? result.value : null);
        };
      });
    } catch (error) {
      console.error(`Error getting ${key} from IndexedDB:`, error);
      return null;
    }
  }

  /**
   * Save value to IndexedDB
   */
  private async saveToIndexedDB(item: SettingsItem): Promise<void> {
    try {
      await this.initDB();
      if (!this.db) return;

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(item);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error(`Error saving ${item.key} to IndexedDB:`, error);
      throw error;
    }
  }

  /**
   * Remove value from IndexedDB
   */
  private async removeFromIndexedDB(key: string): Promise<void> {
    try {
      await this.initDB();
      if (!this.db) return;

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error(`Error removing ${key} from IndexedDB:`, error);
      throw error;
    }
  }

  /**
   * Clear all cached settings (useful for testing or logout)
   */
  clearCache(): void {
  this.cache.clear();
  // debug removed: settings cache cleared
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Preload commonly used settings into cache
   */
  async preloadCache(): Promise<void> {
    const commonKeys = ['theme', 'defaultView', 'weatherProvider'];
    
    for (const key of commonKeys) {
      await this.getValue(key);
    }
    
  // debug removed: common settings preloaded
  }
}

export const settingsStorageService = new SettingsStorageService();
export type { LoadedSettings, SettingsItem };