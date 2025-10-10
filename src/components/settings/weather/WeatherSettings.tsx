import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';
import { MapPin, Lock, AlertTriangle, Navigation } from 'lucide-react';
import { useSecurity } from '@/contexts/security/SecurityContext';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';

interface WeatherSettingsProps {
  coordinates: string;
  onCoordinatesChange: (coordinates: string) => void;
  onUseManualLocationChange: (useManual: boolean) => void;
}

const WeatherSettings = ({
  coordinates,
  onCoordinatesChange,
  onUseManualLocationChange
}: WeatherSettingsProps) => {
  const { isSecurityEnabled } = useSecurity();
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [currentLocation, setCurrentLocation] = useState<string>('');

  // Load manual location preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('useManualLocation');
    if (saved !== null) {
      const useManual = saved === 'true';
      setUseManualLocation(useManual);
      onUseManualLocationChange(useManual);
    }
  }, [onUseManualLocationChange]);

  const handleCoordinatesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCoordinatesChange(e.target.value);
  };

  const checkLocationPermission = async () => {
    if (!navigator.geolocation) {
      setLocationPermission('unknown');
      return;
    }

    try {
      if ('permissions' in navigator && navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        setLocationPermission(permission.state);
      } else if (navigator.geolocation) {
        // For older browsers, try to get location to check permission
        navigator.geolocation.getCurrentPosition(
          () => setLocationPermission('granted'),
          () => setLocationPermission('denied'),
          { timeout: 5000 }
        );
      }
    } catch (error) {
      setLocationPermission('unknown');
    }
  };

  const requestLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve(pos);
          },
          reject,
          { timeout: 10000 }
        );
      });

      setLocationPermission('granted');
      const coords = `${position.coords.latitude.toFixed(4)},${position.coords.longitude.toFixed(4)}`;
      setCurrentLocation(coords);
      setUseManualLocation(false);
      onUseManualLocationChange(false);
      localStorage.setItem('useManualLocation', 'false');
    } catch (error) {
      setLocationPermission('denied');
      alert('Location access denied. You can still use manual coordinates entry.');
    }
  };

  const toggleManualLocation = () => {
    const newValue = !useManualLocation;
    setUseManualLocation(newValue);
    onUseManualLocationChange(newValue);
    localStorage.setItem('useManualLocation', newValue.toString());
  };

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const locationModeDescription = useManualLocation
    ? 'Using manually entered latitude and longitude'
    : 'Using browser geolocation for current position';

  return (
    <div className="space-y-4">
      {/* Weather Service Info */}
      <InfoBanner variant="info">
        <InfoBannerIcon>
          <MapPin className="h-5 w-5" />
        </InfoBannerIcon>
        <InfoBannerContent>
          <InfoBannerTitle variant="info">National Weather Service</InfoBannerTitle>
          <InfoBannerDescription variant="info">
            Using the free National Weather Service API. No API key required.
          </InfoBannerDescription>
        </InfoBannerContent>
      </InfoBanner>

      {/* Location Settings */}
      <SettingsSectionCard
        heading="Location Settings"
        description={locationModeDescription}
  icon={<MapPin className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
        actions={(
          <Button
            onClick={toggleManualLocation}
            variant={useManualLocation ? "default" : "outline"}
            size="sm"
          >
            {useManualLocation ? 'Switch to Auto' : 'Use Manual'}
          </Button>
        )}
      >
        <div className="space-y-3">
          {!useManualLocation && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-green-700 dark:text-green-300">Location Permission:</span>
                <div className="flex items-center gap-2">
                  {locationPermission === 'granted' && (
                    <span className="text-xs bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 px-2 py-1 rounded">
                      Granted
                    </span>
                  )}
                  {locationPermission === 'denied' && (
                    <span className="text-xs bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 px-2 py-1 rounded">
                      Denied
                    </span>
                  )}
                  {(locationPermission === 'prompt' || locationPermission === 'unknown') && (
                    <Button
                      onClick={requestLocation}
                      variant="outline"
                      size="sm"
                      className="text-xs py-1 px-2 h-auto"
                    >
                      <Navigation className="h-3 w-3 mr-1" />
                      Request Permission
                    </Button>
                  )}
                </div>
              </div>
              
              {currentLocation && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Current location: {currentLocation}
                </div>
              )}
              
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Automatic location uses your browser's geolocation to get current coordinates.
              </div>
            </div>
          )}

          {useManualLocation && (
            <div className="pt-3 border-t border-green-200 dark:border-green-700">
              <div className="text-xs text-green-700 dark:text-green-300">
                Manual coordinates entry enabled. Enter latitude and longitude below.
              </div>
            </div>
          )}
        </div>
      </SettingsSectionCard>

      {/* Coordinates Input */}
      {useManualLocation && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="coordinates" className="text-gray-700 dark:text-gray-300">
              Coordinates (Latitude, Longitude)
            </Label>
            {isSecurityEnabled && (
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Lock className="h-3 w-3" />
                <span>Encrypted</span>
              </div>
            )}
          </div>
          <Input
            id="coordinates"
            placeholder="39.8283,-98.5795 (latitude,longitude)"
            value={coordinates}
            onChange={handleCoordinatesChange}
            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
          />
          {isSecurityEnabled && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Your coordinates will be encrypted automatically when saved.
            </p>
          )}
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Format: latitude,longitude (e.g., 39.8283,-98.5795). You can find coordinates on Google Maps.
          </p>
        </div>
      )}

      {/* Help Text */}
      <SettingsSectionCard
        heading="About National Weather Service"
  icon={<AlertTriangle className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          The NWS provides free, accurate weather data for the United States. No API key or registration required.
        </p>
      </SettingsSectionCard>
    </div>
  );
};

export default WeatherSettings;