
/**
 * Display Settings Hook
 * 
 * Manages display-related settings using tiered storage (cache → localStorage → IndexedDB).
 */

import { useState, useEffect, useCallback } from 'react';
import { settingsStorageService } from '@/services/settingsStorageService';
import { safeLocalStorage } from '@/utils/storage/safeLocalStorage';

export const useDisplaySettings = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [defaultView, setDefaultView] = useState<'month' | 'week' | 'timeline'>('timeline');
  const [keepScreenAwake, setKeepScreenAwakeState] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Wrapper function to match the expected interface signature
  const setKeepScreenAwake = useCallback((enabled: boolean) => {
    setKeepScreenAwakeState(enabled);
  }, [setKeepScreenAwakeState]);

  // Load initial settings from tiered storage
  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      try {
        const savedTheme = await settingsStorageService.getValue('theme') as 'light' | 'dark' | 'system' | null;
        const savedDefaultView = await settingsStorageService.getValue('defaultView') as 'month' | 'week' | 'timeline' | null;
        const savedKeepScreenAwake = await settingsStorageService.getValue('keepScreenAwake');
        
        if (!isMounted) return;
        if (savedTheme) {
          setTheme(savedTheme);
        }
        if (savedDefaultView) {
          setDefaultView(savedDefaultView);
        }
        if (savedKeepScreenAwake !== null) {
          setKeepScreenAwakeState(savedKeepScreenAwake === 'true');
        }
      } catch (error) {
        console.warn('Failed to load display settings:', error);
        
        if (!isMounted) return;
        
        // Fallback to localStorage for compatibility
        const fallbackTheme = safeLocalStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
        const fallbackDefaultView = safeLocalStorage.getItem('defaultView') as 'month' | 'week' | 'timeline' | null;
        const fallbackKeepScreenAwake = safeLocalStorage.getItem('keepScreenAwake');
        
        if (!isMounted) return;

        if (fallbackTheme) setTheme(fallbackTheme);
        if (fallbackDefaultView) setDefaultView(fallbackDefaultView);
        if (fallbackKeepScreenAwake !== null) setKeepScreenAwakeState(fallbackKeepScreenAwake === 'true');
      } finally {
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    };
    
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-save theme to tiered storage (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;
    
    settingsStorageService.setValue('theme', theme).catch(error => {
      console.warn('Failed to save theme to tiered storage:', error);
      // Fallback to localStorage
  safeLocalStorage.setItem('theme', theme);
    });
  }, [theme, isInitialized]);

  // Auto-save default view to tiered storage (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;
    
    settingsStorageService.setValue('defaultView', defaultView).catch(error => {
      console.warn('Failed to save defaultView to tiered storage:', error);
      // Fallback to localStorage
  safeLocalStorage.setItem('defaultView', defaultView);
    });
  }, [defaultView, isInitialized]);

  // Auto-save keep screen awake to tiered storage (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;
    
    settingsStorageService.setValue('keepScreenAwake', keepScreenAwake.toString()).catch(error => {
      console.warn('Failed to save keepScreenAwake to tiered storage:', error);
      // Fallback to localStorage
  safeLocalStorage.setItem('keepScreenAwake', keepScreenAwake.toString());
    });
  }, [keepScreenAwake, isInitialized]);

  return {
    theme,
    setTheme,
    defaultView,
    setDefaultView,
    keepScreenAwake,
    setKeepScreenAwake,
  };
};
