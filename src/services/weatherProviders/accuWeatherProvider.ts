/**
 * AccuWeather Provider
 * 
 * Implements AccuWeather API integration via Supabase Edge Function
 * to eliminate CORS issues and provide server-side caching.
 */

import { WeatherProvider, WeatherData, WeatherProviderConfig } from './types';
import { mapAccuWeatherCondition } from '@/utils/weatherIcons';
import { supabase } from '@/integrations/supabase/client';
import { weatherStorageService } from '@/services/weatherStorageService';

// Minimal AccuWeather types (only fields we actually use). Keep loose (optional props) to avoid over-commitment.
interface AccuWeatherCurrentConditions {
  Temperature?: { Imperial?: { Value?: number } };
  WeatherText?: string;
  RelativeHumidity?: number;
  Wind?: { Speed?: { Imperial?: { Value?: number } } };
  UVIndex?: number;
  locationName?: string; // injected by edge function sometimes
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
  Date: string; // ISO
  Temperature: { Maximum: { Value: number }; Minimum: { Value: number } };
  Day: AccuWeatherDailyForecastDayPart;
  Night?: AccuWeatherDailyForecastDayPart;
  [key: string]: unknown;
}

interface AccuWeatherForecastData {
  DailyForecasts?: AccuWeatherDailyForecastEntry[];
  [key: string]: unknown;
}

interface AccuWeatherEdgeResponse {
  current?: AccuWeatherCurrentConditions;
  forecast?: AccuWeatherForecastData;
  locationName?: string;
  lastUpdated?: string;
  error?: string;
  [key: string]: unknown; // tolerate additional fields
}

export class AccuWeatherProvider implements WeatherProvider {
  name = 'accuweather';
  displayName = 'AccuWeather';
  maxForecastDays = 30;
  requiresApiKey = true;

  async fetchWeather(location: string, config: WeatherProviderConfig): Promise<WeatherData> {
  // debug removed: fetchWeather invocation details
    
    try {
  const { data, error } = await supabase.functions.invoke<AccuWeatherEdgeResponse>('weather-proxy', {
        body: {
          zipCode: location || '', // Send empty string for IP-based location
          apiKey: config.apiKey
        }
      });

      if (error) {
        console.error('AccuWeatherProvider - Edge function error:', error);
        throw new Error(`Weather service error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No weather data received from service');
      }

      // If there's an error in the response data
      if (data.error) {
        console.error('AccuWeatherProvider - API error response:', data.error);
        throw new Error(data.error);
      }

  // debug removed: raw response summary

      // Store in tiered storage system immediately after successful API call
      if (data && !data.error) {
        await this.storeWeatherDataInTieredStorage(data, location);
      }

      // Transform the server response to our WeatherData format
      const weatherData: WeatherData = {
        location: this.extractLocationName(data),
        temperature: this.extractTemperature(data),
        condition: this.extractCondition(data),
        description: this.extractDescription(data),
        humidity: this.extractHumidity(data),
        windSpeed: this.extractWindSpeed(data),
        uvIndex: this.extractUVIndex(data),
        forecast: this.extractForecast(data),
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        provider: this.displayName
      };

  // debug removed: transformed weather data summary
      return weatherData;

    } catch (error) {
      console.error('AccuWeatherProvider - API error, checking tiered storage:', error);
      
      // Try to use tiered storage data when API fails
      const cachedRawData = await weatherStorageService.getRawNWSData();
      if (cachedRawData) {
  // debug removed: using tiered storage fallback
        const edgeData = cachedRawData as AccuWeatherEdgeResponse; // safe best-effort cast
        const weatherData: WeatherData = {
          location: this.extractLocationName(edgeData),
          temperature: this.extractTemperature(edgeData),
          condition: this.extractCondition(edgeData),
          description: this.extractDescription(edgeData),
          humidity: this.extractHumidity(edgeData),
          windSpeed: this.extractWindSpeed(edgeData),
          uvIndex: this.extractUVIndex(edgeData),
          forecast: this.extractForecast(edgeData),
          lastUpdated: edgeData.lastUpdated || new Date().toISOString(),
          provider: `${this.displayName} (Cached)`
        };
        return weatherData;
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

  private async storeWeatherDataInTieredStorage(data: AccuWeatherEdgeResponse, location: string): Promise<void> {
    try {
      // Store raw data
      await weatherStorageService.saveRawNWSData(data);
      
      // Transform and store current weather data
      const transformedWeatherData: WeatherData = {
        location: this.extractLocationName(data),
        temperature: this.extractTemperature(data),
        condition: this.extractCondition(data),
        description: this.extractDescription(data),
        humidity: this.extractHumidity(data),
        windSpeed: this.extractWindSpeed(data),
        uvIndex: this.extractUVIndex(data),
        forecast: this.extractForecast(data),
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        provider: this.displayName
      };
      await weatherStorageService.saveCurrentWeather(transformedWeatherData);
      
      // Store forecast data
      if (data.forecast?.DailyForecasts && Array.isArray(data.forecast.DailyForecasts)) {
        const forecasts = data.forecast.DailyForecasts.map((day) => ({
          date: new Date(day.Date).toISOString().split('T')[0],
            high: Math.round(day.Temperature.Maximum.Value),
            low: Math.round(day.Temperature.Minimum.Value),
            condition: this.mapCondition(day.Day.IconPhrase || ''),
            description: day.Day.LongPhrase || day.Day.IconPhrase || ''
        }));
        
        await weatherStorageService.saveForecastData(forecasts);
      }
      
  // debug removed: weather data stored in tiered storage
    } catch (error) {
      console.warn('AccuWeatherProvider - Failed to store weather data in tiered storage:', error);
    }
  }

  private extractLocationName(data: AccuWeatherEdgeResponse): string {
    // Try to get location from the edge function response first
    if (data.locationName) {
      return data.locationName;
    }
    
    // Try to get location from current conditions
    if (data.current?.locationName) {
      return data.current.locationName;
    }
    
    // Create a reasonable location name from available data
    return 'Current Location';
  }

  private extractTemperature(data: AccuWeatherEdgeResponse): number {
    if (data.current?.Temperature?.Imperial?.Value) {
      return Math.round(data.current.Temperature.Imperial.Value);
    }
    return 72; // Fallback temperature
  }

  private extractCondition(data: AccuWeatherEdgeResponse): string {
    if (data.current?.WeatherText) {
      return this.mapCondition(data.current.WeatherText);
    }
    return 'Clear';
  }

  private extractDescription(data: AccuWeatherEdgeResponse): string {
    if (data.current?.WeatherText) {
      return data.current.WeatherText;
    }
    return 'Weather conditions unavailable';
  }

  private extractHumidity(data: AccuWeatherEdgeResponse): number {
    if (data.current?.RelativeHumidity !== undefined) {
      return data.current.RelativeHumidity;
    }
    return 50; // Fallback humidity
  }

  private extractWindSpeed(data: AccuWeatherEdgeResponse): number {
    if (data.current?.Wind?.Speed?.Imperial?.Value !== undefined) {
      return data.current.Wind.Speed.Imperial.Value;
    }
    return 5; // Fallback wind speed
  }

  private extractUVIndex(data: AccuWeatherEdgeResponse): number {
    if (data.current?.UVIndex !== undefined) {
      return data.current.UVIndex;
    }
    return 3; // Fallback UV index
  }

  private extractForecast(data: AccuWeatherEdgeResponse): Array<{
    date: string;
    high: number;
    low: number;
    condition: string;
    description: string;
  }> {
    if (data.forecast?.DailyForecasts && Array.isArray(data.forecast.DailyForecasts)) {
      return data.forecast.DailyForecasts.map((day) => ({
        date: new Date(day.Date).toISOString().split('T')[0],
        high: Math.round(day.Temperature.Maximum.Value),
        low: Math.round(day.Temperature.Minimum.Value),
        condition: this.mapCondition(day.Day.IconPhrase || ''),
        description: day.Day.LongPhrase || day.Day.IconPhrase || ''
      }));
    }

    // Fallback forecast if none available
    return this.getMinimalForecast();
  }

  private getMinimalForecast() {
    // Return a basic 3-day forecast as fallback
    const today = new Date();
    return Array.from({ length: 3 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      return {
        date: date.toISOString().split('T')[0],
        high: 75,
        low: 60,
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