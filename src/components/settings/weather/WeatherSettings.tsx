
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Lock } from 'lucide-react';
import { useSecurity } from '@/contexts/SecurityContext';
import SecurityUnlockBanner from '@/components/security/SecurityUnlockBanner';

interface WeatherSettingsProps {
  zipCode: string;
  onZipCodeChange: (zipCode: string) => void;
  weatherApiKey: string;
  onWeatherApiKeyChange: (apiKey: string) => void;
  onSecurityUnlock?: () => void;
}

const WeatherSettings = ({
  zipCode,
  onZipCodeChange,
  weatherApiKey,
  onWeatherApiKeyChange,
  onSecurityUnlock
}: WeatherSettingsProps) => {
  const { isSecurityEnabled, hasLockedData } = useSecurity();

  // Allow editing even when security is enabled - users can edit and re-encrypt
  const fieldsDisabled = false;

  console.log('WeatherSettings - Security state:', { 
    isSecurityEnabled, 
    hasLockedData, 
    fieldsDisabled,
    zipCode: zipCode ? `${zipCode.substring(0, 3)}...` : 'empty',
    weatherApiKey: weatherApiKey ? `${weatherApiKey.substring(0, 8)}...` : 'empty'
  });

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('WeatherSettings - Zip code input change:', e.target.value);
    onZipCodeChange(e.target.value);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('WeatherSettings - API key input change:', e.target.value.substring(0, 8) + '...');
    onWeatherApiKeyChange(e.target.value);
  };

  return (
    <div className="space-y-4">
      {/* Show unlock banner if data is locked */}
      <SecurityUnlockBanner onUnlock={onSecurityUnlock} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="api-key" className="text-gray-700 dark:text-gray-300">OpenWeatherMap API Key</Label>
          {isSecurityEnabled && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Lock className="h-3 w-3" />
              <span>Encrypted</span>
            </div>
          )}
        </div>
        <Input
          id="api-key"
          type="password"
          placeholder="Enter your OpenWeatherMap API key"
          value={weatherApiKey}
          onChange={handleApiKeyChange}
          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Get a free API key from{' '}
          <a 
            href="https://openweathermap.org/api" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            OpenWeatherMap
          </a>
          {isSecurityEnabled && (
            <span className="text-green-600 dark:text-green-400 ml-2">
              • Data will be encrypted automatically
            </span>
          )}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="zipcode" className="text-gray-700 dark:text-gray-300">Zip Code</Label>
          {isSecurityEnabled && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Lock className="h-3 w-3" />
              <span>Encrypted</span>
            </div>
          )}
        </div>
        <Input
          id="zipcode"
          placeholder="Enter your zip code (e.g., 90210)"
          value={zipCode}
          onChange={handleZipCodeChange}
          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
        />
        {isSecurityEnabled && (
          <p className="text-xs text-green-600 dark:text-green-400">
            Your zip code will be encrypted automatically when saved.
          </p>
        )}
      </div>

      {!isSecurityEnabled && !hasLockedData && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">Security Notice</p>
              <p>Your API key is stored unencrypted. Enable security in the Security tab for enhanced protection.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherSettings;
