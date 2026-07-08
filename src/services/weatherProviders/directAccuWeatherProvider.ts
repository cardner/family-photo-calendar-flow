/**
 * Direct AccuWeather Provider
 * 
 * Implements direct AccuWeather API integration without Supabase dependencies.
 * Handles API calls directly from the frontend with CORS proxy support.
 */

import { WeatherProvider, WeatherData, WeatherProviderConfig } from './types';
import { mapAccuWeatherCondition } from '@/utils/weatherIcons';
import { weatherStorageService } from '@/services/weatherStorageService';

// Reuse minimal AccuWeather response shape definitions (subset only)
interface AccuWeatherCurrentConditions {
  LocationText?: string;
  Temperature?: { Imperial?: { Value?: number } };
  WeatherText?: string;
  RelativeHumidity?: number;
  Wind?: { Speed?: { Imperial?: { Value?: number } } };
  UVIndex?: number;
  [key: string]: unknown;
}

interface AccuWeatherDailyForecastDayPart {
  IconPhrase?: string;
  LongPhrase?: string;
  RelativeHumidity?: { Average?: number };
  Wind?: { Speed?: { Value?: number } };
  UVIndex?: number;
  [key: string]: unknown;
}

interface AccuWeatherDailyForecastEntry {
  Date: string;
  Temperature: { Maximum: { Value: number }; Minimum: { Value: number } };
  Day: AccuWeatherDailyForecastDayPart;
  Night?: AccuWeatherDailyForecastDayPart;
  [key: string]: unknown;
}

interface AccuWeatherForecastData {
  DailyForecasts?: AccuWeatherDailyForecastEntry[];
  [key: string]: unknown;
}

type AccuWeatherLocationLookup = Array<{ Key: string }> | { Key: string } | unknown;

export class DirectAccuWeatherProvider implements WeatherProvider {
  name = 'accuweather-direct';
  displayName = 'AccuWeather Direct';
  maxForecastDays = 15;
  requiresApiKey = true;

  private readonly baseUrl = 'http://dataservice.accuweather.com';
  private readonly corsProxyUrl = 'https://api.allorigins.win/raw?url=';

  async fetchWeather(location: string, config: WeatherProviderConfig): Promise<WeatherData> {
  // debug removed: fetchWeather invocation details
    
    try {
      // Step 1: Get location key
  const locationKey = await this.getLocationKey(location, config.apiKey);

      // Step 2: Fetch current conditions and forecast in parallel
      const [currentData, forecastData] = await Promise.all([
        this.fetchCurrentConditions(locationKey, config.apiKey),
        this.fetchForecast(locationKey, config.apiKey)
      ]);

  // debug removed: raw data received

      // Store raw data for caching and fallback
      const rawData = {
        current: currentData,
        forecast: forecastData,
        locationKey,
        lastUpdated: new Date().toISOString()
      };
      
      // Cache raw data immediately after successful API calls
      await weatherStorageService.saveRawNWSData(rawData);

      // Transform to our standard format
      const weatherData: WeatherData = {
        location: this.extractLocationName(currentData, location),
        temperature: this.extractTemperature(currentData),
        condition: this.extractCondition(currentData),
        description: this.extractDescription(currentData),
        humidity: this.extractHumidity(currentData),
        windSpeed: this.extractWindSpeed(currentData),
        uvIndex: this.extractUVIndex(currentData),
        forecast: this.extractForecast(forecastData),
        lastUpdated: new Date().toISOString(),
        provider: this.displayName
      };

      // Save current weather and forecast data to storage
      await weatherStorageService.saveCurrentWeather(weatherData);
      await weatherStorageService.saveForecastData(weatherData.forecast);

  // debug removed: processed weather data summary

      return weatherData;

    } catch (error) {
      console.error('DirectAccuWeatherProvider - API error, checking cached data:', error);
      
      // Try to use cached data when API fails
      const cachedData = await this.loadFromCache();
      if (cachedData) {
  // debug removed: using cached data fallback
        return cachedData;
      }
      
      // Enhanced error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Invalid API key')) {
          throw new Error('Invalid AccuWeather API key or access denied', { cause: error });
        }
        if (error.message.includes('400') || error.message.includes('location not found')) {
          throw new Error('Location not found - please check your zip code', { cause: error });
        }
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          throw new Error('API rate limit exceeded - please try again later', { cause: error });
        }
        if (error.message.includes('timeout') || error.message.includes('network')) {
          throw new Error('Weather service temporarily unavailable - please try again', { cause: error });
        }
      }
      
      throw error;
    }
  }

  private async getLocationKey(location: string, apiKey: string): Promise<string> {
    let url: string;
    
    if (location && location.trim()) {
      // Use provided location (zip code or city)
      const encodedLocation = encodeURIComponent(location);
      url = `${this.corsProxyUrl}${encodeURIComponent(`${this.baseUrl}/locations/v1/cities/search?apikey=${apiKey}&q=${encodedLocation}`)}`;
    } else {
      // Use IP-based location detection
      url = `${this.corsProxyUrl}${encodeURIComponent(`${this.baseUrl}/locations/v1/cities/geoposition/search?apikey=${apiKey}&q=`)}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Location lookup failed: ${response.status} ${response.statusText}`);
    }

    const data: AccuWeatherLocationLookup = await response.json();
    if (Array.isArray(data) && data.length > 0 && typeof (data[0] as { Key?: unknown })?.Key === 'string') {
      return (data[0] as { Key: string }).Key;
    } else if (!Array.isArray(data) && data && typeof (data as { Key?: unknown }).Key === 'string') {
      return (data as { Key: string }).Key; // minimal narrowing
    }
    
    throw new Error('Location not found');
  }

  private async fetchCurrentConditions(locationKey: string, apiKey: string): Promise<AccuWeatherCurrentConditions> {
    const url = `${this.corsProxyUrl}${encodeURIComponent(`${this.baseUrl}/currentconditions/v1/${locationKey}?apikey=${apiKey}&details=true`)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Current conditions fetch failed: ${response.status} ${response.statusText}`);
    }

    const data: unknown = await response.json();
    return Array.isArray(data) ? (data[0] as AccuWeatherCurrentConditions) : (data as AccuWeatherCurrentConditions);
  }

  private async fetchForecast(locationKey: string, apiKey: string): Promise<AccuWeatherForecastData> {
    const url = `${this.corsProxyUrl}${encodeURIComponent(`${this.baseUrl}/forecasts/v1/daily/15day/${locationKey}?apikey=${apiKey}&details=true&metric=false`)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Forecast fetch failed: ${response.status} ${response.statusText}`);
    }

  return response.json();
  }

  private async loadFromCache(): Promise<WeatherData | null> {
    try {
      const currentWeather = await weatherStorageService.getCurrentWeather();
      if (!currentWeather) return null;

      // Get forecast data from storage
      const forecastPromises = Array.from({ length: 15 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return weatherStorageService.getForecastForDate(date.toISOString().split('T')[0]);
      });

      const forecastResults = await Promise.all(forecastPromises);
      const validForecasts = forecastResults.filter(f => f !== null).map(f => ({
        date: f!.date,
        temp: f!.temp,
        high: f!.high,
        low: f!.low,
        condition: f!.condition,
        description: f!.description,
        humidity: f!.humidity,
        windSpeed: f!.windSpeed,
        uvIndex: f!.uvIndex
      }));

      return {
        location: currentWeather.location,
        temperature: currentWeather.temperature,
        condition: currentWeather.condition,
        description: currentWeather.description,
        humidity: currentWeather.humidity,
        windSpeed: currentWeather.windSpeed,
        uvIndex: currentWeather.uvIndex,
        forecast: validForecasts,
        lastUpdated: currentWeather.lastUpdated,
        provider: `${currentWeather.provider} (Cached)`
      };
    } catch (error) {
      console.error('Error loading from cache:', error);
      return null;
    }
  }

  private extractLocationName(currentData: AccuWeatherCurrentConditions | null, originalLocation?: string): string {
    // Try to extract location from current conditions
    if (currentData?.LocationText) {
      return currentData.LocationText;
    }
    
    // Fallback to provided location or default
    return originalLocation || 'Current Location';
  }

  private extractTemperature(currentData: AccuWeatherCurrentConditions | null): number {
    if (currentData?.Temperature?.Imperial?.Value !== undefined) {
      return Math.round(currentData.Temperature.Imperial.Value);
    }
    return 72; // Fallback temperature
  }

  private extractCondition(currentData: AccuWeatherCurrentConditions | null): string {
    if (currentData?.WeatherText) {
      return this.mapCondition(currentData.WeatherText);
    }
    return 'Clear';
  }

  private extractDescription(currentData: AccuWeatherCurrentConditions | null): string {
    if (currentData?.WeatherText) {
      return currentData.WeatherText;
    }
    return 'Weather conditions unavailable';
  }

  private extractHumidity(currentData: AccuWeatherCurrentConditions | null): number {
    if (currentData?.RelativeHumidity !== undefined) {
      return currentData.RelativeHumidity;
    }
    return 50; // Fallback humidity
  }

  private extractWindSpeed(currentData: AccuWeatherCurrentConditions | null): number {
    if (currentData?.Wind?.Speed?.Imperial?.Value !== undefined) {
      return currentData.Wind.Speed.Imperial.Value;
    }
    return 5; // Fallback wind speed
  }

  private extractUVIndex(currentData: AccuWeatherCurrentConditions | null): number {
    if (currentData?.UVIndex !== undefined) {
      return currentData.UVIndex;
    }
    return 3; // Fallback UV index
  }

  private extractForecast(forecastData: AccuWeatherForecastData | null): Array<{
    date: string;
    high: number;
    low: number;
    temp?: number;
    condition: string;
    description: string;
    humidity?: number;
    windSpeed?: number;
    uvIndex?: number;
  }> {
    if (forecastData?.DailyForecasts && Array.isArray(forecastData.DailyForecasts)) {
      return forecastData.DailyForecasts.map((day) => ({
        date: new Date(day.Date).toISOString().split('T')[0],
        high: Math.round(day.Temperature.Maximum.Value),
        low: Math.round(day.Temperature.Minimum.Value),
        temp: Math.round((day.Temperature.Maximum.Value + day.Temperature.Minimum.Value) / 2),
        condition: this.mapCondition(day.Day.IconPhrase || ''),
        description: day.Day.LongPhrase || day.Day.IconPhrase || '',
        humidity: day.Day.RelativeHumidity?.Average,
        windSpeed: day.Day.Wind?.Speed?.Value,
        uvIndex: day.Day.UVIndex
      }));
    }

    // Fallback forecast if none available
    return this.getMinimalForecast();
  }

  private getMinimalForecast() {
    // Return a basic 7-day forecast as fallback
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      return {
        date: date.toISOString().split('T')[0],
        high: 75,
        low: 60,
        temp: 68,
        condition: 'Clear',
        description: 'Weather forecast temporarily unavailable'
      };
    });
  }

  private mapCondition(accuWeatherCondition: string): string {
    return mapAccuWeatherCondition(accuWeatherCondition);
  }

  validateApiKey(apiKey: string): boolean {
    // AccuWeather API keys are typically 32 character alphanumeric strings
    return /^[a-zA-Z0-9]{32}$/.test(apiKey);
  }

  getConfigRequirements() {
    return {
      apiKeyUrl: 'https://developer.accuweather.com/',
      documentation: 'https://developer.accuweather.com/accuweather-forecast-api/apis',
      pricingUrl: 'https://developer.accuweather.com/packages'
    };
  }
}