import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getICalCalendars: vi.fn(),
  replaceICalCalendars: vi.fn(),
  getNotionCalendars: vi.fn(),
  replaceNotionCalendars: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  removeSetting: vi.fn(),
}));

vi.mock('@/services/calendarStorage', () => ({
  calendarStorageService: {
    getAllCalendars: mocks.getICalCalendars,
    replaceAllCalendars: mocks.replaceICalCalendars,
  },
}));

vi.mock('@/services/notionScrapedEventsStorage', () => ({
  notionScrapedEventsStorage: {
    getAllCalendars: mocks.getNotionCalendars,
    replaceAllCalendars: mocks.replaceNotionCalendars,
  },
}));

vi.mock('@/services/settingsStorageService', () => ({
  settingsStorageService: {
    getValue: mocks.getSetting,
    setValue: mocks.setSetting,
    removeValue: mocks.removeSetting,
  },
}));

import {
  calendarConfigManager,
  parseCalendarConfig,
  sanitizeNotionCalendar,
} from '@/utils/calendarConfigManager';
import { NotionScrapedCalendar } from '@/types/notion';

const validConfig = {
  type: 'family-calendar-config',
  version: '1.0',
  exportDate: '2026-08-11T12:00:00.000Z',
  icalCalendars: [
    {
      id: 'ical-1',
      name: 'Family',
      url: 'https://example.com/family.ics',
      color: '#123456',
      enabled: true,
      syncFrequencyPerDay: 4,
    },
  ],
  notionCalendars: [
    {
      id: 'notion-1',
      name: 'Plans',
      url: 'https://notion.so/example',
      color: '#abcdef',
      enabled: true,
      type: 'notion-scraped',
      connectionMode: 'api',
      metadata: {
        url: 'https://notion.so/example',
        title: 'Plans',
        token: 'secret-token',
        databaseId: 'database-id',
      },
    },
  ],
  settings: {
    notionToken: 'global-token',
    notionDatabaseId: null,
  },
  selectedCalendarIds: ['ical-1', 'notion-1'],
} as const;

describe('calendarConfigManager', () => {
  beforeEach(() => {
    mocks.replaceICalCalendars.mockResolvedValue(undefined);
    mocks.replaceNotionCalendars.mockResolvedValue(undefined);
    mocks.setSetting.mockResolvedValue(undefined);
    mocks.removeSetting.mockResolvedValue(undefined);
  });

  it('validates supported configuration files', () => {
    expect(parseCalendarConfig(validConfig)).toEqual(validConfig);
    expect(() => parseCalendarConfig({ ...validConfig, version: '2.0' })).toThrow(
      'Invalid or unsupported'
    );
    expect(() =>
      parseCalendarConfig({
        ...validConfig,
        icalCalendars: [...validConfig.icalCalendars, validConfig.icalCalendars[0]],
      })
    ).toThrow('duplicate calendar IDs');
  });

  it('strips transient Notion sync state from exported calendars', () => {
    const calendar: NotionScrapedCalendar = {
      ...validConfig.notionCalendars[0],
      metadata: {
        ...validConfig.notionCalendars[0].metadata,
        lastScraped: new Date(),
        eventCount: 12,
      },
      lastSync: 'yesterday',
      lastSuccessfulSync: 'yesterday',
      lastSyncCursor: 'cursor',
      eventCount: 12,
      lastSetupAttempt: 'today',
      lastSetupResult: 'error',
      lastSetupError: 'network error',
    };

    expect(sanitizeNotionCalendar(calendar)).toEqual(validConfig.notionCalendars[0]);
  });

  it('replaces calendars and restores Notion settings and selection on import', async () => {
    const file = {
      text: vi.fn().mockResolvedValue(JSON.stringify(validConfig)),
    } as unknown as File;

    await calendarConfigManager.importCalendarConfig(file);

    expect(mocks.replaceICalCalendars).toHaveBeenCalledWith(validConfig.icalCalendars);
    expect(mocks.replaceNotionCalendars).toHaveBeenCalledWith([
      {
        ...validConfig.notionCalendars[0],
        metadata: {
          ...validConfig.notionCalendars[0].metadata,
          lastScraped: new Date(0),
          eventCount: 0,
        },
      },
    ]);
    expect(mocks.setSetting).toHaveBeenCalledWith('notion_token', 'global-token');
    expect(mocks.removeSetting).toHaveBeenCalledWith('notion_database_id');
    expect(localStorage.getItem('selectedCalendarIds')).toBe(
      JSON.stringify(validConfig.selectedCalendarIds)
    );
  });
});
