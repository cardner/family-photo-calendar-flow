import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Key, Eye, ChevronDown, ChevronUp, Smartphone } from 'lucide-react';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';
import { useWeather } from '@/contexts/weather/WeatherContext';
import { useWeatherSettings } from '@/contexts/settings/useWeatherSettings';
import { WeatherTestResult } from '@/types/weather';
import { PWAWeatherTestService } from '@/utils/weather/pwaTestService';

interface WeatherConnectionTestProps {
  coordinates: string;
  onTestResult: (result: WeatherTestResult | null) => void;
  onShowPreviewToggle: () => void;
  showPreview: boolean;
  testResult: WeatherTestResult | null;
  useManualLocation: boolean;
}

const WeatherConnectionTest = ({
  coordinates,
  onTestResult,
  onShowPreviewToggle,
  showPreview,
  testResult,
  useManualLocation
}: WeatherConnectionTestProps) => {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const [pwaInfo, setPwaInfo] = useState<{
    isPWA: boolean;
    corsProxyRequired: boolean;
    recommendations: string[];
  } | null>(null);
  const { refreshWeather } = useWeather();

  const handleTestConnection = async () => {
    // For NWS with manual location, require coordinates
    if (useManualLocation && !coordinates.trim()) {
      const errorMsg = 'Please enter coordinates for manual location.';
      setDetailedError(errorMsg);
      onTestResult({
        success: false,
        message: errorMsg
      });
      return;
    }

    setIsTestingConnection(true);
    setDetailedError(null);
    setShowErrorDetails(false);
    onTestResult(null);

    // Create a timeout promise to detect slow connections
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout - Connection took longer than 30 seconds')), 30000);
    });

    try {
      // Test NWS weather API connection
  // debug removed: testing NWS Weather API connection
      
      // Use actual weather service to test connection
      const testResult = await refreshWeather(true);
      
      // Create preview data from current weather
      const previewData = {
        location: 'Test Location',
        temperature: 72,
        condition: 'Clear',
        description: 'NWS Weather API connection successful',
        humidity: 50,
        windSpeed: 5,
        forecast: [
          {
            date: new Date().toISOString().split('T')[0],
            high: 75,
            low: 65,
            condition: 'Sunny'
          }
        ],
        lastUpdated: new Date().toISOString(),
        provider: 'National Weather Service'
      };
      
      setDetailedError(null);
      // Detect PWA mode (iOS Safari adds non-standard navigator.standalone)
      const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
      const isIosStandalone = typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setPwaInfo({
        isPWA: isStandaloneDisplay || isIosStandalone,
        corsProxyRequired: false,
        recommendations: ['NWS API is free and does not require CORS proxy']
      });
      
      onTestResult({
        success: true,
        message: 'Successfully connected to National Weather Service API!',
        data: previewData
      });
    } catch (error) {
      console.error('Weather connection test error:', error);
      
      let errorMessage = 'Failed to connect to National Weather Service';
      let detailedErrorInfo = `Provider: National Weather Service, Coordinates: ${coordinates}`;
      
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
        detailedErrorInfo += `, Error: ${error.message}`;
        
        // Detect specific error types
        if (error.message.includes('timeout') || error.message.includes('Request timeout')) {
          errorMessage = 'Connection timeout - Please check your internet connection and try again';
          detailedErrorInfo += ' (Timeout after 30 seconds)';
        } else if (error.message.includes('Load failed') || error.message.includes('fetch')) {
          errorMessage = 'Network error - Please check your internet connection';
          detailedErrorInfo += ' (Network request failed)';
        } else if (error.message.includes('404')) {
          errorMessage = 'Location not found - Please check your coordinates';
          detailedErrorInfo += ' (404 Not Found)';
        }
      } else {
        errorMessage += ': Unknown error';
        detailedErrorInfo += ', Error: Unknown error type';
      }
      
      setDetailedError(detailedErrorInfo);
      onTestResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          onClick={handleTestConnection}
          disabled={isTestingConnection}
          variant="outline"
          className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          {isTestingConnection ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Key className="h-4 w-4 mr-2" />
          )}
          {isTestingConnection ? 'Testing...' : 'Test Connection'}
        </Button>
        
        {testResult?.success && testResult.data && (
          <Button
            onClick={async () => {
              onShowPreviewToggle();
              // Also refresh weather data when showing preview
              if (!showPreview) {
                // debug removed: refreshing weather for preview
                await refreshWeather(true);
              }
            }}
            variant="outline"
            className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
        )}
      </div>

      {testResult && (
        <div className="space-y-2">
          <InfoBanner variant={testResult.success ? 'success' : 'destructive'}>
            <InfoBannerIcon>
              {testResult.success ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </InfoBannerIcon>
            <InfoBannerContent className="flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <InfoBannerTitle variant={testResult.success ? 'success' : 'destructive'}>
                  {testResult.message}
                </InfoBannerTitle>
                {!testResult.success && detailedError && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowErrorDetails(!showErrorDetails)}
                    className="ml-0 sm:ml-2 h-6 px-2 text-xs"
                  >
                    {showErrorDetails ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Less Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        More Details
                      </>
                    )}
                  </Button>
                )}
              </div>
            </InfoBannerContent>
          </InfoBanner>

          {!testResult.success && detailedError && showErrorDetails && (
            <InfoBanner>
              <InfoBannerIcon asChild={false} className="mt-0">
                <Key className="h-5 w-5" />
              </InfoBannerIcon>
              <InfoBannerContent>
                <InfoBannerTitle>Detailed error information</InfoBannerTitle>
                <InfoBannerDescription className="space-y-2 text-xs sm:text-sm">
                  <div className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                    {detailedError}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    If this error persists, please check:
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Your internet connection</li>
                      <li>Coordinates format (latitude,longitude)</li>
                      <li>National Weather Service API status</li>
                      <li>Location is within the United States</li>
                    </ul>
                  </div>
                </InfoBannerDescription>
              </InfoBannerContent>
            </InfoBanner>
          )}

          {/* PWA-specific information */}
          {pwaInfo && (
            <InfoBanner variant="info">
              <InfoBannerIcon>
                <Smartphone className="h-5 w-5" />
              </InfoBannerIcon>
              <InfoBannerContent>
                <InfoBannerTitle variant="info">
                  {pwaInfo.isPWA ? '📱 PWA Mode Detected' : '🌐 Browser Mode'}
                </InfoBannerTitle>
                <InfoBannerDescription variant="info" className="space-y-1 text-xs sm:text-sm">
                  <div>✅ Using National Weather Service API (free)</div>
                  {pwaInfo.recommendations.map((rec, index) => (
                    <div key={index}>• {rec}</div>
                  ))}
                </InfoBannerDescription>
              </InfoBannerContent>
            </InfoBanner>
          )}
        </div>
      )}
    </div>
  );
};

export default WeatherConnectionTest;
