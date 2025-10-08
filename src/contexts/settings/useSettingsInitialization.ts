/**
 * Settings Initialization Hook
 * 
 * Handles loading all settings from storage on application startup.
 * Manages the initialization sequence and provides loading state.
 */

import { useEffect, useState } from 'react';
import { SettingsStorage } from './settingsStorage';
import { isTestEnv } from '@/utils/env';

interface InitializationProps {
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setDefaultView: (view: 'month' | 'week' | 'timeline') => void;
  setKeepScreenAwake: (enabled: boolean) => void;
  setCoordinates: (coordinates: string) => void;
  setUseManualLocation: (useManual: boolean) => void;
  setPublicAlbumUrl: (url: string) => void;
  setGithubOwner: (owner: string) => void;
  setGithubRepo: (repo: string) => void;
  setNotionToken: (token: string) => void;
  setNotionDatabaseId: (databaseId: string) => void;
  setBackgroundDuration: (duration: number) => void;
  setSelectedAlbum: (albumId: string | null) => void;
}

/**
 * Initialize all application settings from storage
 * 
 * Loads settings from both secure and regular storage, with automatic
 * migration between storage types when security is enabled/disabled.
 */
export const useSettingsInitialization = (props: InitializationProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const isTest = isTestEnv();

  useEffect(() => {
    if (isTest) {
      // Fast path for tests: mark as not loading without side-effects
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const initializeSettings = async () => {
      try {
        await SettingsStorage.preloadCache();
        const settings = await SettingsStorage.loadAllSettings();
        if (cancelled) return;
        if (settings.theme) props.setTheme(settings.theme);
        if (settings.defaultView) props.setDefaultView(settings.defaultView);
        if (settings.keepScreenAwake !== undefined) props.setKeepScreenAwake(settings.keepScreenAwake === 'true');
        if (settings.backgroundDuration) props.setBackgroundDuration(parseInt(settings.backgroundDuration) || 30);
        if (settings.selectedAlbum) props.setSelectedAlbum(settings.selectedAlbum);
        if (settings.coordinates) props.setCoordinates(settings.coordinates);
        if (settings.useManualLocation !== undefined) props.setUseManualLocation(settings.useManualLocation === 'true');
        if (settings.publicAlbumUrl) props.setPublicAlbumUrl(settings.publicAlbumUrl);
        if (settings.githubOwner) props.setGithubOwner(settings.githubOwner);
        if (settings.githubRepo) props.setGithubRepo(settings.githubRepo);
        if (settings.notionToken) props.setNotionToken(settings.notionToken);
        if (settings.notionDatabaseId) props.setNotionDatabaseId(settings.notionDatabaseId);
      } catch (error) {
        if (!cancelled) console.error('❌ Settings initialization failed:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    initializeSettings();
    return () => { cancelled = true; };
  }, [props, isTest]);

  return { isLoading };
};
