
import React from 'react';
import { Info } from 'lucide-react';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon } from '@/components/ui/info-banner';

const WeatherInfo = () => {
  return (
    <div className="space-y-4">
      <InfoBanner variant="info">
        <InfoBannerIcon>
          <Info className="h-5 w-5" />
        </InfoBannerIcon>
        <InfoBannerContent>
          <InfoBannerDescription variant="info">
            Weather data is provided by the National Weather Service API. The app displays current conditions and forecasts including temperature and weather icons in calendar views.
          </InfoBannerDescription>
        </InfoBannerContent>
      </InfoBanner>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p className="font-medium mb-2 text-gray-900 dark:text-gray-100">Weather features:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Real-time current temperature and conditions</li>
          <li>Weather forecast for calendar views</li>
          <li>Weather icons in Month and Week calendar views</li>
          <li>Location-based weather using coordinates</li>
          <li>Free National Weather Service data for US locations</li>
        </ul>
      </div>
    </div>
  );
};

export default WeatherInfo;
