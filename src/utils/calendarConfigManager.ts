import { calendarStorageService, CalendarFeed } from '@/services/calendarStorage';
import { notionScrapedEventsStorage } from '@/services/notionScrapedEventsStorage';
import { settingsStorageService } from '@/services/settingsStorageService';
import { NotionPageMetadata, NotionScrapedCalendar } from '@/types/notion';
import { safeLocalStorage } from '@/utils/storage/safeLocalStorage';

const CONFIG_TYPE = 'family-calendar-config';
const CONFIG_VERSION = '1.0';
const SELECTED_CALENDARS_KEY = 'selectedCalendarIds';
const NOTION_TOKEN_KEY = 'notion_token';
const NOTION_DATABASE_ID_KEY = 'notion_database_id';

type PortableNotionMetadata = Omit<NotionPageMetadata, 'lastScraped' | 'eventCount'>;
type PortableNotionCalendar = Omit<
  NotionScrapedCalendar,
  | 'lastSync'
  | 'lastSuccessfulSync'
  | 'lastSyncCursor'
  | 'eventCount'
  | 'lastSetupAttempt'
  | 'lastSetupResult'
  | 'lastSetupError'
  | 'metadata'
> & {
  metadata?: PortableNotionMetadata;
};

export interface CalendarConfigFile {
  type: typeof CONFIG_TYPE;
  version: typeof CONFIG_VERSION;
  exportDate: string;
  icalCalendars: CalendarFeed[];
  notionCalendars: PortableNotionCalendar[];
  settings: {
    notionToken: string | null;
    notionDatabaseId: string | null;
  };
  selectedCalendarIds?: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasStringProperties = (value: unknown, properties: string[]): value is Record<string, unknown> =>
  isRecord(value) && properties.every(property => typeof value[property] === 'string');

const hasUniqueIds = (items: Array<{ id: string }>): boolean =>
  new Set(items.map(item => item.id)).size === items.length;

export const sanitizeICalCalendar = (calendar: CalendarFeed): CalendarFeed => {
  const { lastSync: _lastSync, eventCount: _eventCount, ...config } = calendar;
  return config;
};

export const sanitizeNotionCalendar = (
  calendar: NotionScrapedCalendar
): PortableNotionCalendar => {
  const {
    lastSync: _lastSync,
    lastSuccessfulSync: _lastSuccessfulSync,
    lastSyncCursor: _lastSyncCursor,
    eventCount: _eventCount,
    lastSetupAttempt: _lastSetupAttempt,
    lastSetupResult: _lastSetupResult,
    lastSetupError: _lastSetupError,
    metadata,
    ...config
  } = calendar;

  if (!metadata) return config;

  const {
    lastScraped: _lastScraped,
    eventCount: _metadataEventCount,
    ...portableMetadata
  } = metadata;

  return { ...config, metadata: portableMetadata };
};

const validateICalCalendar = (value: unknown): value is CalendarFeed =>
  hasStringProperties(value, ['id', 'name', 'url', 'color']) &&
  typeof value.enabled === 'boolean' &&
  (value.syncFrequencyPerDay === undefined || typeof value.syncFrequencyPerDay === 'number');

const validateNotionCalendar = (value: unknown): value is PortableNotionCalendar => {
  if (
    !hasStringProperties(value, ['id', 'name', 'url', 'color', 'type']) ||
    value.type !== 'notion-scraped' ||
    typeof value.enabled !== 'boolean'
  ) {
    return false;
  }

  if (
    value.connectionMode !== undefined &&
    value.connectionMode !== 'api' &&
    value.connectionMode !== 'public'
  ) {
    return false;
  }

  return value.metadata === undefined || isRecord(value.metadata);
};

export const parseCalendarConfig = (value: unknown): CalendarConfigFile => {
  if (!isRecord(value) || value.type !== CONFIG_TYPE || value.version !== CONFIG_VERSION) {
    throw new Error('Invalid or unsupported calendar configuration file.');
  }

  if (!Array.isArray(value.icalCalendars) || !value.icalCalendars.every(validateICalCalendar)) {
    throw new Error('The configuration contains invalid iCal calendars.');
  }

  if (
    !Array.isArray(value.notionCalendars) ||
    !value.notionCalendars.every(validateNotionCalendar)
  ) {
    throw new Error('The configuration contains invalid Notion calendars.');
  }

  if (
    !hasUniqueIds(value.icalCalendars) ||
    !hasUniqueIds(value.notionCalendars)
  ) {
    throw new Error('The configuration contains duplicate calendar IDs.');
  }

  if (!isRecord(value.settings)) {
    throw new Error('The configuration contains invalid Notion settings.');
  }

  const { notionToken, notionDatabaseId } = value.settings;
  if (
    (notionToken !== null && typeof notionToken !== 'string') ||
    (notionDatabaseId !== null && typeof notionDatabaseId !== 'string')
  ) {
    throw new Error('The configuration contains invalid Notion settings.');
  }

  if (
    value.selectedCalendarIds !== undefined &&
    (!Array.isArray(value.selectedCalendarIds) ||
      !value.selectedCalendarIds.every(id => typeof id === 'string'))
  ) {
    throw new Error('The configuration contains an invalid calendar selection.');
  }

  return value as unknown as CalendarConfigFile;
};

const restoreNotionCalendar = (calendar: PortableNotionCalendar): NotionScrapedCalendar => ({
  ...calendar,
  metadata: calendar.metadata
    ? {
        ...calendar.metadata,
        lastScraped: new Date(0),
        eventCount: 0,
      }
    : undefined,
});

const downloadJson = (data: CalendarConfigFile): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `family-calendar-config-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

class CalendarConfigManager {
  async createConfig(): Promise<CalendarConfigFile> {
    const [icalCalendars, notionCalendars, notionToken, notionDatabaseId] = await Promise.all([
      calendarStorageService.getAllCalendars(),
      notionScrapedEventsStorage.getAllCalendars(),
      settingsStorageService.getValue(NOTION_TOKEN_KEY),
      settingsStorageService.getValue(NOTION_DATABASE_ID_KEY),
    ]);

    const selectedCalendarIdsValue = safeLocalStorage.getItem(SELECTED_CALENDARS_KEY);
    let selectedCalendarIds: string[] | undefined;
    if (selectedCalendarIdsValue) {
      try {
        const parsed = JSON.parse(selectedCalendarIdsValue);
        if (Array.isArray(parsed) && parsed.every(id => typeof id === 'string')) {
          selectedCalendarIds = parsed;
        }
      } catch {
        // Ignore malformed local selection data rather than blocking export.
      }
    }

    return {
      type: CONFIG_TYPE,
      version: CONFIG_VERSION,
      exportDate: new Date().toISOString(),
      icalCalendars: icalCalendars.map(sanitizeICalCalendar),
      notionCalendars: notionCalendars.map(sanitizeNotionCalendar),
      settings: { notionToken, notionDatabaseId },
      selectedCalendarIds,
    };
  }

  async exportCalendarConfig(): Promise<void> {
    downloadJson(await this.createConfig());
  }

  async importCalendarConfig(file: File): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error('Failed to parse the calendar configuration file.');
    }

    const config = parseCalendarConfig(parsed);
    const notionCalendars = config.notionCalendars.map(restoreNotionCalendar);

    await calendarStorageService.replaceAllCalendars(config.icalCalendars);
    await notionScrapedEventsStorage.replaceAllCalendars(notionCalendars);

    await this.restoreSetting(NOTION_TOKEN_KEY, config.settings.notionToken);
    await this.restoreSetting(NOTION_DATABASE_ID_KEY, config.settings.notionDatabaseId);

    if (config.selectedCalendarIds) {
      safeLocalStorage.setItem(
        SELECTED_CALENDARS_KEY,
        JSON.stringify(config.selectedCalendarIds)
      );
    }
  }

  private async restoreSetting(key: string, value: string | null): Promise<void> {
    if (value === null) {
      await settingsStorageService.removeValue(key);
      return;
    }
    await settingsStorageService.setValue(key, value);
  }
}

export const calendarConfigManager = new CalendarConfigManager();
