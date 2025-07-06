
/**
 * Photo Settings Hook
 * 
 * Manages photo and background-related settings with secure storage and validation.
 */

import { useState, useEffect } from 'react';
import { InputValidator } from '@/utils/security/inputValidation';
import { SettingsStorage } from './settingsStorage';

export const usePhotoSettings = () => {
  const [publicAlbumUrl, setPublicAlbumUrl] = useState('');
  const [backgroundDuration, setBackgroundDuration] = useState(30); // Default 30 minutes
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);

  // Load initial settings
  useEffect(() => {
    const loadSettings = () => {
      const savedUrl = SettingsStorage.getSetting('publicAlbumUrl', true) || '';
      const savedDuration = parseInt(localStorage.getItem('backgroundDuration') || '30');
      const savedAlbum = localStorage.getItem('selectedAlbum');
      
      console.log('🖼️ usePhotoSettings - Loading saved settings:');
      console.log('🖼️ savedUrl:', savedUrl);
      console.log('🖼️ savedDuration:', savedDuration);
      console.log('🖼️ savedAlbum:', savedAlbum);
      
      setPublicAlbumUrl(savedUrl);
      setBackgroundDuration(savedDuration);
      setSelectedAlbum(savedAlbum);
    };

    loadSettings();
  }, []);

  // Auto-save public album URL to appropriate storage
  useEffect(() => {
    console.log('🖼️ usePhotoSettings - Auto-saving publicAlbumUrl:', publicAlbumUrl);
    SettingsStorage.saveSetting('publicAlbumUrl', publicAlbumUrl, true);
  }, [publicAlbumUrl]);

  // Auto-save background duration to localStorage
  useEffect(() => {
    localStorage.setItem('backgroundDuration', backgroundDuration.toString());
  }, [backgroundDuration]);

  // Auto-save selected album to localStorage
  useEffect(() => {
    if (selectedAlbum) {
      localStorage.setItem('selectedAlbum', selectedAlbum);
    } else {
      localStorage.removeItem('selectedAlbum');
    }
  }, [selectedAlbum]);

  /**
   * Enhanced public album URL setter with input validation
   */
  const setValidatedPublicAlbumUrl = (url: string) => {
    console.log('🖼️ usePhotoSettings - setValidatedPublicAlbumUrl called with:', url);
    console.log('🖼️ usePhotoSettings - URL type:', typeof url);
    console.log('🖼️ usePhotoSettings - URL length:', url?.length);
    
    // Always set the URL, even if empty - let the Google Photos hook handle validation
    console.log('🖼️ usePhotoSettings - Setting URL directly (validation moved to useGooglePhotos)');
    setPublicAlbumUrl(url);
  };

  return {
    publicAlbumUrl,
    setPublicAlbumUrl: setValidatedPublicAlbumUrl,
    backgroundDuration,
    setBackgroundDuration,
    selectedAlbum,
    setSelectedAlbum,
  };
};
