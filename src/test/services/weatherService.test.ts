
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWeatherData } from '@/services/weatherService';

// Mock InputValidator with all methods
vi.mock('@/utils/security/inputValidation', () => ({
  InputValidator: {
    validateZipCode: vi.fn().mockReturnValue({ isValid: true, error: null }),
    validateApiKey: vi.fn().mockReturnValue({ isValid: true, error: null }),
    validateUrl: vi.fn().mockReturnValue({ isValid: true, error: null }),
    validateGithubUsername: vi.fn().mockReturnValue({ isValid: true, error: null }),
    validateGithubRepoName: vi.fn().mockReturnValue({ isValid: true, error: null }),
  },
}));

describe('weatherService', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = mockFetch;
  });

  it('should fetch weather data successfully', async () => {
    const mockWeatherResponse = {
      main: { temp: 75.2 },
      weather: [{ main: 'Clear', description: 'clear sky' }],
      name: 'Beverly Hills',
      sys: { country: 'US' }
    };

    const mockForecastResponse = {
      list: [
        {
          dt: Math.floor(Date.now() / 1000),
          main: { temp_max: 78, temp_min: 65 },
          weather: [{ main: 'Sunny', description: 'sunny' }],
          dt_txt: new Date().toISOString().split('T')[0]
        }
      ]
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWeatherResponse)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockForecastResponse)
      });

    const result = await fetchWeatherData('90210', 'test-api-key');

    // Check the actual structure returned by the weather service
    expect(result).toEqual({
      location: 'Beverly Hills',
      temperature: 75,
      condition: 'Clear',
      forecast: expect.any(Array),
      lastUpdated: expect.any(String),
      provider: 'OpenWeatherMap'
    });
  });

  it('should handle API errors gracefully', async () => {
    // Mock console.error to suppress error output in tests
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockFetch.mockRejectedValue(new Error('API Error'));

    const result = await fetchWeatherData('90210', 'invalid-key');
    
    // Should return mock data when API fails
    expect(result).toEqual({
      location: 'Location not found',
      temperature: 72,
      condition: 'Clear',
      forecast: expect.any(Array),
      lastUpdated: expect.any(String),
      provider: 'Mock Data'
    });

    consoleSpy.mockRestore();
  });
});
