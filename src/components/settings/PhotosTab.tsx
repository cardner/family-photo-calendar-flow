
import React from 'react';
import { Camera } from 'lucide-react';
import AlbumUrlInput from './AlbumUrlInput';
import PhotosPreview from './PhotosPreview';
import BackgroundSettings from './BackgroundSettings';
import { useGooglePhotos } from '@/hooks/useGooglePhotos';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

const PhotosTab = () => {
  const {
    images,
    isLoading,
    error,
    lastFetch,
    refreshPhotos,
    testAlbumConnection,
    clearCache,
    hasValidAlbumUrl
  } = useGooglePhotos();

  return (
    <SettingsSectionCard
      heading={(
        <span className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Photo Settings
        </span>
      )}
      description="Configure background photos from Google Photos albums and display settings"
      contentClassName="space-y-6"
    >
      <AlbumUrlInput onTestConnection={testAlbumConnection} />

      {hasValidAlbumUrl && (
        <PhotosPreview
          images={images}
          isLoading={isLoading}
          error={error}
          lastFetch={lastFetch}
          onRefresh={refreshPhotos}
          onClearCache={clearCache}
        />
      )}

      <BackgroundSettings />
    </SettingsSectionCard>
  );
};

export default PhotosTab;
