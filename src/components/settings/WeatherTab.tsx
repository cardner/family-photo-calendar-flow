import React, { useState, useEffect } from 'react';
import { CloudSun } from 'lucide-react';
import { useSecurity } from '@/contexts/security/SecurityContext';
import { useWeatherSettings } from '@/contexts/settings/useWeatherSettings';
import WeatherSettings from './weather/WeatherSettings';
import WeatherConnectionTest from './weather/WeatherConnectionTest';
import WeatherPreview from './weather/WeatherPreview';
import WeatherInfo from './weather/WeatherInfo';
import { WeatherTestResult } from '@/types/weather';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

const WeatherTab = () => {
  const [testResult, setTestResult] = useState<WeatherTestResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { isSecurityEnabled, hasLockedData } = useSecurity();
  const {
    coordinates,
    setCoordinates,
    useManualLocation: weatherUseManualLocation,
    setUseManualLocation: setWeatherUseManualLocation
  } = useWeatherSettings();

  // Clear test results when security state changes to force re-testing with new data
  useEffect(() => {
    setTestResult(null);
    setShowPreview(false);
  }, [isSecurityEnabled, hasLockedData]);

  return (
    <SettingsSectionCard
      heading={(
        <span className="flex items-center gap-2">
          <CloudSun className="h-5 w-5" />
          Weather Settings
        </span>
      )}
      description="Configure weather display for your location using real-time weather data"
      contentClassName="space-y-4"
    >
      <WeatherSettings
        coordinates={coordinates}
        onCoordinatesChange={setCoordinates}
        onUseManualLocationChange={setWeatherUseManualLocation}
      />

      <WeatherConnectionTest
        coordinates={coordinates}
        onTestResult={setTestResult}
        onShowPreviewToggle={() => setShowPreview(!showPreview)}
        showPreview={showPreview}
        testResult={testResult}
        useManualLocation={weatherUseManualLocation}
      />

      {showPreview && testResult?.success && testResult.data && (
        <div className="mt-4">
          <WeatherPreview weatherData={testResult.data} />
        </div>
      )}

      <WeatherInfo />
    </SettingsSectionCard>
  );
};

export default WeatherTab;
