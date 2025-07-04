
import React from 'react';
import { Sun, Cloud, CloudRain, Snowflake } from 'lucide-react';

interface WeatherDisplayProps {
  weather: { temp: number; condition: string };
  className?: string;
  forceWhite?: boolean;
}

const WeatherDisplay = ({ weather, className = '', forceWhite = false }: WeatherDisplayProps) => {
  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'sunny':
      case 'clear':
        return <Sun className="h-4 w-4 text-yellow-400" />;
      case 'cloudy':
      case 'partly cloudy':
        return <Cloud className="h-4 w-4 text-gray-300" />;
      case 'rain':
      case 'rainy':
        return <CloudRain className="h-4 w-4 text-blue-400" />;
      case 'snow':
      case 'snowy':
        return <Snowflake className="h-4 w-4 text-blue-200" />;
      default:
        return <Sun className="h-4 w-4 text-yellow-400" />;
    }
  };

  const textColor = forceWhite ? 'text-white' : 'text-gray-600 dark:text-gray-300';

  return (
    <div className={`flex items-center gap-2 ${textColor} ${className}`}>
      {getWeatherIcon(weather.condition)}
      <span className="font-medium">{weather.temp}°</span>
    </div>
  );
};

export default WeatherDisplay;
