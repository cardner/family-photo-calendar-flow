
import React from 'react';
import { WeatherData, WeatherForecastDay } from '@/types/weather';
import { getWeatherIcon } from '@/utils/weatherIcons';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

interface WeatherPreviewProps {
  weatherData: WeatherData;
}

const WeatherPreview = ({ weatherData }: WeatherPreviewProps) => {
  const formatCondition = (condition: string) => {
    return condition.charAt(0).toUpperCase() + condition.slice(1).toLowerCase();
  };

  // Safety check for weatherData
  if (!weatherData) {
    return (
      <SettingsSectionCard
        heading="Weather Preview"
        description="Run a connection test to generate preview data"
        contentClassName="p-4"
      >
        <div className="text-gray-600 dark:text-gray-400">
          No weather data available for preview
        </div>
      </SettingsSectionCard>
    );
  }

  return (
    <SettingsSectionCard
      heading="Weather Preview"
      description={`Current weather and 7-day forecast for ${weatherData.location}`}
      contentClassName="space-y-4"
      className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Current Weather</h4>
          <div className="flex items-center gap-3">
            {getWeatherIcon(weatherData.condition, { size: "h-8 w-8" })}
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {weatherData.temperature}°F
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {formatCondition(weatherData.condition)}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">7-Day Forecast</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {(weatherData.forecast || []).slice(0, 7).map((day: WeatherForecastDay, index: number) => {
              const date = new Date(day.date);
              const isToday = index === 0;
              return (
                <div key={day.date} className="flex justify-between items-center text-sm py-1">
                  <div className="flex items-center gap-2">
                    {getWeatherIcon(day.condition, { size: "h-4 w-4" })}
                    <span className="text-gray-600 dark:text-gray-400">
                      {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {day.high || day.temp}°{day.low ? `/${day.low}°` : ''}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 text-xs">
                      {formatCondition(day.condition)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SettingsSectionCard>
  );
};

export default WeatherPreview;
