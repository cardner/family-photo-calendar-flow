
/**
 * Settings Storage Utilities
 * 
 * Enhanced centralized storage management for application settings with
 * tiered caching (memory -> localStorage -> IndexedDB) and automatic encryption.
 */

import { secureStorage } from '@/utils/security/secureStorage';
import { settingsStorageService } from '@/services/settingsStorageService';

interface LoadedSettings {
  theme?: 'light' | 'dark' | 'system' | null;
  defaultView?: 'month' | 'week' | 'timeline' | null;
  keepScreenAwake?: string | null;
  backgroundDuration?: string | null;
  selectedAlbum?: string | null;
  coordinates?: string | null;
  weatherProvider?: string | null;
  useManualLocation?: string | null;
  publicAlbumUrl?: string | null;
  githubOwner?: string | null;
  githubRepo?: string | null;
  notionToken?: string | null;
  notionDatabaseId?: string | null;
}

/**
 * Get a storage value using tiered storage (cache -> localStorage -> IndexedDB)
 */
export const getStorageValue = async (key: string, isSensitive: boolean = false): Promise<string | null> => {
  try {
    return await settingsStorageService.getValue(key);
  } catch (error) {
    console.warn(`Failed to get ${key} from tiered storage:`, error);
    // Fallback to direct localStorage access
    return localStorage.getItem(key);
  }
};

/**
 * Save a storage value using tiered storage (cache + localStorage + IndexedDB)
 */
export const saveStorageValue = async (key: string, value: string, isSensitive: boolean = false): Promise<void> => {
  try {
    await settingsStorageService.setValue(key, value);
  } catch (error) {
    console.warn(`Failed to save ${key} to tiered storage, using localStorage fallback:`, error);
    localStorage.setItem(key, value);
  }
};

export class SettingsStorage {
  /**
   * Get a storage value from appropriate storage (secure or regular)
   */
  static async getStorageValue(key: string, isSensitive: boolean = false): Promise<string | null> {
    return getStorageValue(key, isSensitive);
  }
  /**
   * Load all settings using tiered storage approach
   */
  static async loadAllSettings(): Promise<LoadedSettings> {
    try {
      // Use the enhanced storage service that handles tiered storage
      const settings = await settingsStorageService.loadAllSettings();
      
      // Migrate any legacy settings if needed
      if (secureStorage.exists('test')) {
        await this.migrateSensitiveSettings();
      }
      
      return settings;
    } catch (error) {
      console.error('Error loading settings from tiered storage:', error);
      
      // Fallback to direct localStorage access
      return {
        theme: localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null,
        defaultView: localStorage.getItem('defaultView') as 'month' | 'week' | 'timeline' | null,
        backgroundDuration: localStorage.getItem('backgroundDuration'),
        selectedAlbum: localStorage.getItem('selectedAlbum'),
        coordinates: localStorage.getItem('coordinates'),
        weatherProvider: localStorage.getItem('weatherProvider'),
        useManualLocation: localStorage.getItem('useManualLocation'),
        publicAlbumUrl: localStorage.getItem('publicAlbumUrl'),
        githubOwner: localStorage.getItem('githubOwner'),
        githubRepo: localStorage.getItem('githubRepo'),
        notionToken: localStorage.getItem('notion_token'),
        notionDatabaseId: localStorage.getItem('notion_database_id'),
      };
    }
  }

  /**
   * Migrate sensitive settings from localStorage to secure storage
   */
  private static async migrateSensitiveSettings() {
    const sensitiveKeys = ['coordinates', 'publicAlbumUrl', 'githubOwner', 'githubRepo', 'notion_token', 'notion_database_id'];
    
    for (const key of sensitiveKeys) {
      const oldValue = localStorage.getItem(key);
      if (oldValue) {
        try {
          await secureStorage.store(key, oldValue, 'defaultPassword');
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(`Failed to migrate ${key}:`, error);
        }
      }
    }
  }

  /**
   * Get a setting synchronously (cache first, then localStorage fallback)
   */
  static getSetting(key: string, isSensitive: boolean = false): string | null {
    try {
      // Check cache first for immediate access
      const cacheStats = settingsStorageService.getCacheStats();
      if (cacheStats.keys.includes(key)) {
        // Cache hit - async call but we need sync, so fallback to localStorage
        return localStorage.getItem(key);
      }
      
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to get ${key}:`, error);
      return localStorage.getItem(key);
    }
  }

  /**
   * Save a setting to tiered storage (async)
   */
  static async saveSetting(key: string, value: string, isSensitive: boolean = false) {
    try {
      await settingsStorageService.setValue(key, value);
    } catch (error) {
      console.warn(`Failed to save ${key} to tiered storage, using localStorage fallback:`, error);
      localStorage.setItem(key, value);
    }
  }

  /**
   * Remove a setting from all storage layers
   */
  static async removeSetting(key: string, isSensitive: boolean = false) {
    try {
      await settingsStorageService.removeValue(key);
    } catch (error) {
      console.warn(`Failed to remove ${key} from tiered storage:`, error);
      // Fallback to direct removal
      localStorage.removeItem(key);
      if (isSensitive && secureStorage.exists('test')) {
        secureStorage.remove(key);
      }
    }
  }

  /**
   * Clear settings cache (useful for logout or testing)
   */
  static clearCache() {
    settingsStorageService.clearCache();
  }

  /**
   * Preload common settings into cache for better performance
   */
  static async preloadCache() {
    await settingsStorageService.preloadCache();
  }
}
