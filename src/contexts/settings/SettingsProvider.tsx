import React from 'react';
import { SettingsContext } from './SettingsContext';
import { useDisplaySettings } from './useDisplaySettings';
import { useWeatherSettings } from './useWeatherSettings';
import { usePhotoSettings } from './usePhotoSettings';
import { useGitHubSettings } from './useGitHubSettings';
import { useNotionSettings } from './useNotionSettings';
import { useSettingsInitialization } from './useSettingsInitialization';

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const displaySettings = useDisplaySettings();
  const weatherSettings = useWeatherSettings();
  const photoSettings = usePhotoSettings();
  const githubSettings = useGitHubSettings();
  const notionSettings = useNotionSettings();

  useSettingsInitialization({
    setTheme: displaySettings.setTheme,
    setDefaultView: displaySettings.setDefaultView,
    setKeepScreenAwake: displaySettings.setKeepScreenAwake,
    setCoordinates: weatherSettings.setCoordinates,
    setUseManualLocation: weatherSettings.setUseManualLocation,
    setPublicAlbumUrl: photoSettings.setPublicAlbumUrl,
    setGithubOwner: githubSettings.setGithubOwner,
    setGithubRepo: githubSettings.setGithubRepo,
    setNotionToken: notionSettings.setNotionToken,
    setNotionDatabaseId: notionSettings.setNotionDatabaseId,
    setBackgroundDuration: photoSettings.setBackgroundDuration,
    setSelectedAlbum: photoSettings.setSelectedAlbum,
  });

  return (
    <SettingsContext.Provider value={{
      ...displaySettings,
      ...weatherSettings,
      ...photoSettings,
      ...githubSettings,
      ...notionSettings,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
