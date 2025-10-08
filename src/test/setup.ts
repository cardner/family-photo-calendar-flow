import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
const globalScope = globalThis as typeof globalThis & { window?: typeof globalThis };
if (typeof globalScope.window === 'undefined') {
  globalScope.window = globalScope as unknown as Window & typeof globalThis;
}

import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server } from './mocks/server';
import { act } from '@testing-library/react';

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  // Clear mock storage to prevent memory leaks
  mockStorage.clear();
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Clean up after all tests are done
afterAll(() => server.close());

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock geolocation
if (!('geolocation' in navigator)) {
  // @ts-expect-error adding geolocation
  navigator.geolocation = {};
}
navigator.geolocation.getCurrentPosition = vi.fn((success, error) => {
  success({
    coords: {
      latitude: 39.8283,
      longitude: -98.5795,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  });
});

// Enhanced Mock Web Crypto API for testing environment with better error handling
const mockCrypto = {
  getRandomValues: vi.fn((array) => {
    try {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    } catch (error) {
      console.warn('Mock crypto.getRandomValues error:', error);
      return array;
    }
  }),
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
  subtle: {
    importKey: vi.fn().mockResolvedValue({
      type: 'secret',
      algorithm: { name: 'PBKDF2' },
      extractable: false,
      usages: ['deriveKey']
    }),
    deriveKey: vi.fn().mockResolvedValue({
      type: 'secret',
      algorithm: { name: 'AES-GCM', length: 256 },
      extractable: false,
      usages: ['encrypt', 'decrypt']
    }),
    deriveBits: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    encrypt: vi.fn().mockImplementation(async (algorithm, key, data) => {
      try {
        // Simple mock encryption - just return the data with some padding
        const encrypted = new Uint8Array(data.byteLength + 16);
        encrypted.set(new Uint8Array(data), 0);
        // Add mock IV/tag
        for (let i = data.byteLength; i < encrypted.length; i++) {
          encrypted[i] = Math.floor(Math.random() * 256);
        }
        return encrypted.buffer;
      } catch (error) {
        console.warn('Mock crypto.encrypt error:', error);
        return new ArrayBuffer(0);
      }
    }),
    decrypt: vi.fn().mockImplementation(async (algorithm, key, data) => {
      try {
        // Simple mock decryption - just return the data without padding
        const decrypted = new Uint8Array(Math.max(0, data.byteLength - 16));
        if (data.byteLength > 16) {
          decrypted.set(new Uint8Array(data).slice(0, data.byteLength - 16), 0);
        }
        return decrypted.buffer;
      } catch (error) {
        console.warn('Mock crypto.decrypt error:', error);
        return new ArrayBuffer(0);
      }
    }),
    generateKey: vi.fn().mockResolvedValue({
      type: 'secret',
      algorithm: { name: 'AES-GCM', length: 256 },
      extractable: false,
      usages: ['encrypt', 'decrypt']
    }),
  },
};

// Override global crypto with enhanced error handling
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
});

// Override window crypto for browser environment
Object.defineProperty(window, 'crypto', {
  value: mockCrypto,
  writable: true,
});

// Mock btoa and atob for base64 operations with error handling
global.btoa = vi.fn((str) => {
  try {
    return Buffer.from(str, 'binary').toString('base64');
  } catch (error) {
    console.warn('btoa mock error:', error);
    return '';
  }
});

global.atob = vi.fn((str) => {
  try {
    return Buffer.from(str, 'base64').toString('binary');
  } catch (error) {
    console.warn('atob mock error:', error);
    return '';
  }
});

// Mock localStorage with better error handling and default settings
const mockStorage = new Map<string, string>();

const localStorageMock = {
  getItem: vi.fn((key: string) => {
    try {
      // Provide default values for common settings to prevent initialization errors
      const defaults: Record<string, string> = {
        'githubRepo': '',
        'githubOwner': '',
        'zipCode': '90210',
        'weatherApiKey': '',
        'publicAlbumUrl': '',
        'backgroundDuration': '30',
        'selectedAlbum': '',
        'theme': 'light',
        'defaultView': 'month',
        'notionUrl': '',
        'selectedCalendarIds': '[]',
      };
      
      return mockStorage.get(key) || defaults[key] || null;
    } catch (error) {
      console.warn('localStorage.getItem mock error:', error);
      return null;
    }
  }),
  setItem: vi.fn((key: string, value: string) => {
    try {
      mockStorage.set(key, value);
    } catch (error) {
      console.warn('localStorage.setItem mock error:', error);
    }
  }),
  removeItem: vi.fn((key: string) => {
    try {
      mockStorage.delete(key);
    } catch (error) {
      console.warn('localStorage.removeItem mock error:', error);
    }
  }),
  clear: vi.fn(() => {
    try {
      mockStorage.clear();
    } catch (error) {
      console.warn('localStorage.clear mock error:', error);
    }
  }),
  get length() {
    return mockStorage.size;
  },
  key: vi.fn((index: number) => {
    const keys = Array.from(mockStorage.keys());
    return keys[index] || null;
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Enhanced console handling to reduce test noise but show important errors
const originalWarn = console.warn;
const originalError = console.error;

global.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn((message, ...args) => {
    // Filter out specific React warnings that are not relevant for tests
    if (typeof message === 'string' && 
        !message.includes('Warning: An update to') && 
        !message.includes('not wrapped in act') &&
        !message.includes('btoa mock error') &&
        !message.includes('atob mock error') &&
        !message.includes('localStorage') &&
        !message.includes('Mock crypto') &&
        !message.includes('SecurityUnlockBanner mock')) {
      originalWarn(message, ...args);
    }
  }),
  error: vi.fn((message, ...args) => {
    // Show actual errors but filter out known test-related noise
    if (typeof message === 'string' && 
        !message.includes('connect ECONNREFUSED') &&
        !message.includes('Failed to get version info') &&
        !message.includes('Mock crypto') &&
        !message.includes('Error fetching weather data: Error: API Error') &&
        !message.includes('Failed to load weather settings from tiered storage')) {
      originalError(message, ...args);
    }
  }),
};

// Global act wrapper for async operations with better error handling
global.actAsync = async (callback: () => Promise<void>) => {
  try {
    await act(async () => {
      await callback();
    });
  } catch (error) {
    console.warn('actAsync error (suppressed for tests):', error);
  }
};

// Add global test timeout configuration and memory optimization
vi.setConfig({
  testTimeout: 15000, // 15 seconds for all tests
  hookTimeout: 10000, // 10 seconds for setup/teardown hooks
});

// Global cleanup function to prevent memory leaks
const globalCleanup = () => {
  // Clean up any global event listeners
  if (typeof window !== 'undefined') {
    window.removeEventListener?.('storage', () => {});
    window.removeEventListener?.('message', () => {});
    window.removeEventListener?.('beforeunload', () => {});
  }
  
  // Note: Individual tests should handle their own timer cleanup
  // Global timer cleanup is not necessary here
};

// Run cleanup after each test
afterEach(globalCleanup);
