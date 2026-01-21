
/**
 * Hook for managing Notion API-based calendars (formerly scraped calendars)
 */

import { useState, useEffect, useCallback } from 'react';
import { NotionScrapedCalendar, notionScrapedEventsStorage } from '@/services/notionScrapedEventsStorage';
import { NotionScrapedEvent } from '@/services/NotionPageScraper';
import { useToast } from '@/hooks/use-toast';
// Supabase removal: formerly used supabase.functions.invoke('notion-api')
// Replaced with direct Notion API client usage.
// NOTE: If CORS errors arise in the browser, consider adding a lightweight
// proxy service or adjusting the NotionAPIClient to use a different proxy.
import { notionAPIClient, NotionApiError } from '@/services/NotionAPIClient';
import type { PageObjectResponse, DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { notionPageScraper } from '@/services/NotionPageScraper';
import { RateLimiter, createDebounce } from '@/lib/rateLimiter';
import { CalendarRefreshUtils } from '@/hooks/useCalendarRefresh';

import { useBackgroundSync } from './useBackgroundSync';

// Narrowed property fragment types to avoid any usage
interface NotionRichTextFragment { plain_text?: string }
interface NotionSelectOption { name?: string }
interface NotionMultiSelectOption { name?: string }
interface NotionPropertyBase { type: string }
interface NotionTitleProperty extends NotionPropertyBase { type: 'title'; title?: NotionRichTextFragment[] }
interface NotionRichTextProperty extends NotionPropertyBase { type: 'rich_text'; rich_text?: NotionRichTextFragment[] }
interface NotionSelectProperty extends NotionPropertyBase { type: 'select'; select?: NotionSelectOption | null }
interface NotionMultiSelectProperty extends NotionPropertyBase { type: 'multi_select'; multi_select?: NotionMultiSelectOption[] }
interface NotionDateProperty extends NotionPropertyBase { type: 'date'; date?: { start?: string; end?: string } | null }
type NotionPrimitiveProperty = NotionTitleProperty | NotionRichTextProperty | NotionSelectProperty | NotionMultiSelectProperty | NotionDateProperty;
type NotionPropertyMap = Record<string, NotionPrimitiveProperty | undefined>;

interface NotionApiEvent {
  id: string;
  title: string;
  date: string; // ISO date or YYYY-MM-DD
  time?: string;
  description?: string;
  location?: string;
  status?: string;
  categories?: string[];
  priority?: string;
  properties?: NotionPropertyMap;
  sourceUrl?: string;
  scrapedAt?: string;
  endDate?: string;
  customProperties?: Record<string, unknown>;
}

export interface NotionScrapedSyncStatus {
  [calendarId: string]: 'syncing' | 'success' | 'error' | '';
}

export const useNotionScrapedCalendars = () => {
  const [calendars, setCalendars] = useState<NotionScrapedCalendar[]>([]);
  const [events, setEvents] = useState<NotionScrapedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<NotionScrapedSyncStatus>({});
  const { toast } = useToast();
  // Client-side rate limiter & debouncers
  const notionRateLimiterRef = useState(() => new RateLimiter({ capacity: 4, windowMs: 10_000 }))[0];
  const debouncedSyncRef = useState(() => new Map<string, ReturnType<typeof createDebounce>>())[0];
  const RETRY_QUEUE_KEY = 'notion_sync_retry_queue';
  const SETUP_ATTEMPT_KEY = 'notion_setup_last_attempt';
  const LAST_EDITED_SAFETY_MS = 5 * 60 * 1000;
  
  const { 
    registerBackgroundSync, 
    registerPeriodicSync, 
    triggerBackgroundSync,
    isBackgroundSyncSupported,
    processSyncQueue
  } = useBackgroundSync();

  const buildIncrementalFilter = useCallback((lastSuccessfulSync?: string) => {
    if (!lastSuccessfulSync) return undefined;
    const last = new Date(lastSuccessfulSync).getTime();
    if (Number.isNaN(last)) return undefined;
    const after = new Date(Math.max(0, last - LAST_EDITED_SAFETY_MS)).toISOString();
    return {
      timestamp: 'last_edited_time',
      last_edited_time: {
        after
      }
    };
  }, []);

  const recordSetupAttempt = useCallback((payload: { url: string; result: 'success' | 'error'; error?: string; code?: string }) => {
    try {
      localStorage.setItem(SETUP_ATTEMPT_KEY, JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('Failed to record Notion setup attempt', error);
    }
  }, []);

  const enqueueRetry = useCallback((calendarId: string) => {
    try {
      const existing = JSON.parse(localStorage.getItem(RETRY_QUEUE_KEY) || '[]') as string[];
      if (!existing.includes(calendarId)) {
        localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify([...existing, calendarId]));
      }
    } catch (error) {
      console.warn('Failed to enqueue Notion retry', error);
    }
  }, []);

  // Load calendars from IndexedDB
  const loadCalendars = useCallback(async () => {
    try {
      const storedCalendars = await notionScrapedEventsStorage.getAllCalendars();
      setCalendars(storedCalendars);
    } catch (error) {
      console.error('Error loading Notion calendars:', error);
      toast({
        title: "Loading Error",
        description: "Failed to load Notion calendars",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Load events from IndexedDB
  const loadEvents = useCallback(async () => {
    try {
  const storedEvents = await notionScrapedEventsStorage.getAllEvents();
  setEvents(storedEvents);
  // debug removed: loaded Notion events count
    } catch (error) {
      console.error('Error loading Notion events:', error);
    }
  }, []);

  // Add a new calendar
  const addCalendar = useCallback(async (calendarData: Omit<NotionScrapedCalendar, 'id' | 'type'>) => {
    try {
      const newCalendar: NotionScrapedCalendar = {
        ...calendarData,
        id: `notion_api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'notion-scraped'
      };

      await notionScrapedEventsStorage.addCalendar(newCalendar);
      await loadCalendars();
      
      toast({
        title: "Calendar Added",
        description: `Successfully added Notion calendar: ${newCalendar.name}`,
      });

      return newCalendar;
    } catch (error) {
      console.error('Error adding calendar:', error);
      toast({
        title: "Error",
        description: "Failed to add calendar",
        variant: "destructive"
      });
      throw error;
    }
  }, [loadCalendars, toast]);

  // Update a calendar
  const updateCalendar = useCallback(async (id: string, updates: Partial<NotionScrapedCalendar>) => {
    try {
      await notionScrapedEventsStorage.updateCalendar(id, updates);
      await loadCalendars();
    } catch (error) {
      console.error('Error updating calendar:', error);
      toast({
        title: "Update Error",
        description: "Failed to update calendar",
        variant: "destructive"
      });
      throw error;
    }
  }, [loadCalendars, toast]);

  // Remove a calendar
  const removeCalendar = useCallback(async (id: string) => {
    try {
      await notionScrapedEventsStorage.deleteCalendar(id);
      await loadCalendars();
      await loadEvents();
      
      toast({
        title: "Calendar Removed",
        description: "Successfully removed calendar and its events",
      });
    } catch (error) {
      console.error('Error removing calendar:', error);
      toast({
        title: "Error",
        description: "Failed to remove calendar",
        variant: "destructive"
      });
      throw error;
    }
  }, [loadCalendars, loadEvents, toast]);

  // Transform an array of Notion pages (already fully paginated) into internal NotionApiEvent objects
  const transformPages = useCallback((pages: PageObjectResponse[]): NotionApiEvent[] => {
    const events: NotionApiEvent[] = [];
    for (const page of pages) {
      if (!page || page.object !== 'page' || !page.properties) continue;

      // Title
      let title = page.id;
      for (const key of Object.keys(page.properties)) {
        const property = page.properties[key];
        if (property?.type === 'title' && Array.isArray(property.title) && property.title.length) {
          title = property.title.map((fragment) => fragment.plain_text ?? '').join('').trim() || title;
          break;
        }
      }

      // Date (first date property)
      let dateStart: string | undefined;
      let dateEnd: string | undefined;
      for (const key of Object.keys(page.properties)) {
        const property = page.properties[key];
        if (property?.type === 'date' && property.date?.start) {
          dateStart = property.date.start;
          dateEnd = property.date.end;
          break;
        }
      }
      if (!dateStart) continue;

      const simplified: NotionPropertyMap = {};
      for (const key of Object.keys(page.properties)) {
        const property = page.properties[key];
        switch (property?.type) {
          case 'title':
            simplified[key] = {
              type: 'title',
              title: property.title?.map((fragment) => ({ plain_text: fragment.plain_text })),
            } as NotionTitleProperty;
            break;
          case 'rich_text':
            simplified[key] = {
              type: 'rich_text',
              rich_text: property.rich_text?.map((fragment) => ({ plain_text: fragment.plain_text })),
            } as NotionRichTextProperty;
            break;
          case 'select':
            simplified[key] = {
              type: 'select',
              select: property.select ? { name: property.select.name } : null,
            } as NotionSelectProperty;
            break;
          case 'multi_select':
            simplified[key] = {
              type: 'multi_select',
              multi_select: property.multi_select?.map((option) => ({ name: option.name })),
            } as NotionMultiSelectProperty;
            break;
          case 'date':
            simplified[key] = {
              type: 'date',
              date: { start: property.date?.start, end: property.date?.end },
            } as NotionDateProperty;
            break;
          default:
            break;
        }
      }

      events.push({
        id: page.id,
        title,
        date: dateStart,
        endDate: dateEnd,
        description: undefined,
        location: undefined,
        status: undefined,
        categories: undefined,
        priority: undefined,
        properties: simplified,
        sourceUrl: undefined,
        scrapedAt: new Date().toISOString(),
        customProperties: undefined,
      });
    }
    return events;
  }, []);

  // Fetch database metadata (title etc.)
  const getDatabaseMetadata = useCallback(async (databaseId: string, token: string): Promise<Record<string, unknown>> => {
    try {
  const db: DatabaseObjectResponse = await notionAPIClient.getDatabase(databaseId, token);
  const titleParts = (db.title || []).map((fragment) => fragment.plain_text ?? '').join('').trim();
      return {
        databaseTitle: titleParts || 'Notion Database',
        lastFetched: new Date().toISOString(),
        databaseId: db.id,
      };
    } catch (e) {
      console.warn('Failed to fetch database metadata', e);
      return {};
    }
  }, []);

  // Sync a single calendar using direct Notion API
  const MIN_FRESHNESS_MS = 60_000; // 1 minute freshness window

  const performSyncCalendar = useCallback(async (calendar: NotionScrapedCalendar) => {
    // Skip if recently synced within freshness window
    if (calendar.lastSync) {
      const last = new Date(calendar.lastSync).getTime();
      if (!Number.isNaN(last) && Date.now() - last < MIN_FRESHNESS_MS) {
        // Mark as success without hitting API again
        setSyncStatus(prev => ({ ...prev, [calendar.id]: 'success' }));
        return;
      }
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new NotionApiError('Offline: connect to the internet and try again.', 'offline');
    }

    if (calendar.connectionMode !== 'public') {
      if (!calendar.metadata?.token) {
        throw new Error('Notion integration token is required for this calendar');
      }

      if (!calendar.metadata?.databaseId) {
        throw new Error('Database ID is required for this calendar');
      }
    }

  setSyncStatus(prev => ({ ...prev, [calendar.id]: 'syncing' }));
  // Emit start event for progress bar
  CalendarRefreshUtils.triggerNotionRefreshStart(calendar.id);

    try {
  // debug removed: syncing Notion calendar start
      
      let apiEvents: NotionApiEvent[] = [];
      if (calendar.connectionMode === 'public') {
        const scraped = await notionPageScraper.scrapePage(calendar.url);
        apiEvents = scraped.events.map((event) => ({
          id: event.id,
          title: event.title,
          date: event.date instanceof Date ? event.date.toISOString() : String(event.date),
          time: event.time,
          description: event.description,
          location: event.location,
          status: event.status,
          categories: event.categories,
          priority: event.priority,
          properties: event.properties as NotionPropertyMap,
          sourceUrl: event.sourceUrl,
          scrapedAt: event.scrapedAt instanceof Date ? event.scrapedAt.toISOString() : undefined,
          endDate: event.dateRange?.endDate ? event.dateRange.endDate.toISOString() : undefined,
          customProperties: event.customProperties
        }));
      } else {
        // Direct Notion API fully paginated query
        const incrementalFilter = buildIncrementalFilter(calendar.lastSuccessfulSync);
        const pages = await notionAPIClient.queryAllWithOptions(
          calendar.metadata.databaseId!,
          calendar.metadata.token!,
          {
            filter: incrementalFilter,
            startCursor: calendar.lastSyncCursor,
            onPage: async (res) => {
              if (res.next_cursor) {
                await updateCalendar(calendar.id, { lastSyncCursor: res.next_cursor });
              }
            }
          }
        );
        apiEvents = transformPages(pages as PageObjectResponse[]);
      }
      if (apiEvents.length === 0) {
        console.warn('No events returned from Notion database query');
      }
  const notionEvents: NotionScrapedEvent[] = apiEvents.map((event) => {
        // Extract calendar name from properties to use as title
  const calendarNameProperty = event.properties?.['calendar name'] || event.properties?.['Calendar Name'];
  const eventTitle = (calendarNameProperty && calendarNameProperty.type === 'title' && calendarNameProperty.title?.[0]?.plain_text) ||
         (calendarNameProperty && calendarNameProperty.type === 'rich_text' && calendarNameProperty.rich_text?.[0]?.plain_text) ||
         (calendarNameProperty && calendarNameProperty.type === 'select' && calendarNameProperty.select?.name) ||
         event.title;

        // Build description with recipe, notes, and ingredients
        let enhancedDescription = event.description || '';
        
        const specialColumns = ['recipe', 'notes', 'ingredients'];
        const columnDescriptions: string[] = [];
        
        if (event.properties) {
          specialColumns.forEach(columnName => {
            const property = event.properties[columnName] || event.properties[columnName.charAt(0).toUpperCase() + columnName.slice(1)];
            if (property) {
              let value = '';
              if (property.type === 'rich_text' && property.rich_text && Array.isArray(property.rich_text)) {
                value = property.rich_text.map((text) => text.plain_text || '').join('');
              } else if (property.type === 'title' && property.title && Array.isArray(property.title)) {
                value = property.title.map((text) => text.plain_text || '').join('');
              } else if (property.type === 'select' && property.select?.name) {
                value = property.select.name;
              } else if (property.type === 'multi_select' && property.multi_select && Array.isArray(property.multi_select)) {
                value = property.multi_select.map((option) => option.name || '').join(', ');
              }
              
              if (value.trim()) {
                columnDescriptions.push(`${columnName.charAt(0).toUpperCase() + columnName.slice(1)}: ${value}`);
              }
            }
          });
        }

        if (columnDescriptions.length > 0) {
          enhancedDescription = enhancedDescription ? 
            `${enhancedDescription}\n\n${columnDescriptions.join('\n')}` : 
            columnDescriptions.join('\n');
        }

        // Handle dates properly to avoid timezone issues
        let eventDate: Date;
        if (event.date.includes('T')) {
          // If it's a datetime string, use as-is
          eventDate = new Date(event.date);
        } else {
          // If it's a date-only string (YYYY-MM-DD), create date in local timezone
          const [year, month, day] = event.date.split('-').map(Number);
          eventDate = new Date(year, month - 1, day); // month is 0-indexed
        }
        const scrapedDate = new Date(event.scrapedAt);
        
  // debug removed: processing individual Notion event

        return {
          id: event.id,
          title: eventTitle,
          date: eventDate,
          time: event.time,
          description: enhancedDescription,
          location: event.location,
          status: event.status,
          categories: event.categories,
          priority: event.priority,
          properties: event.properties,
          sourceUrl: event.sourceUrl,
          scrapedAt: scrapedDate,
          calendarId: calendar.id,
          customProperties: event.customProperties,
          source: 'notion',
          dateRange: event.date ? {
            startDate: eventDate,
            endDate: event.endDate ? new Date(event.endDate) : undefined
          } : undefined
        };
      });

      // Get existing events for comparison
      const existingEvents = await notionScrapedEventsStorage.getEventsByCalendar(calendar.id);
      
      // Track changes for better sync reporting
      let newCount = 0;
      let updatedCount = 0;
      let unchangedCount = 0;
      
  const existingEventMap = new Map<string, NotionScrapedEvent>();
      existingEvents.forEach(event => {
        existingEventMap.set(event.id, event);
      });
      
  const processedEvents = notionEvents.map(newEvent => {
        const existingEvent = existingEventMap.get(newEvent.id);
        
        if (!existingEvent) {
          newCount++;
          return newEvent;
        } else {
          // Check if event has been updated (check more fields including time)
          const hasChanges = 
            existingEvent.title !== newEvent.title ||
            existingEvent.description !== newEvent.description ||
            existingEvent.location !== newEvent.location ||
            existingEvent.status !== newEvent.status ||
            existingEvent.time !== newEvent.time ||
            new Date(existingEvent.date).getTime() !== new Date(newEvent.date).getTime();
          
          if (hasChanges) {
            updatedCount++;
            // debug removed: updating existing event details
            return { ...newEvent, scrapedAt: new Date() }; // Update scrapedAt timestamp
          } else {
            unchangedCount++;
            return existingEvent; // Keep existing event to preserve any local state
          }
        }
      });
      
      // Calculate removed events
  const newEventIds = new Set<string>(notionEvents.map(e => e.id));
      const removedCount = existingEvents.length - existingEvents.filter(e => newEventIds.has(e.id)).length;
      
      // Save updated events to IndexedDB
      await notionScrapedEventsStorage.saveEvents(calendar.id, processedEvents);
      
  // debug removed: sync stats summary

      // Update calendar metadata
      const dbMeta = calendar.connectionMode === 'public'
        ? {}
        : await getDatabaseMetadata(calendar.metadata.databaseId!, calendar.metadata.token!);
      await updateCalendar(calendar.id, {
        lastSync: new Date().toISOString(),
        lastSuccessfulSync: new Date().toISOString(),
        lastSyncCursor: undefined,
        eventCount: notionEvents.length,
        metadata: {
          ...calendar.metadata,
          ...dbMeta
        }
      });

      // Reload events
      await loadEvents();

      setSyncStatus(prev => ({ ...prev, [calendar.id]: 'success' }));
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${notionEvents.length} events from ${calendar.name}`,
      });

  // debug removed: successful Notion sync summary
      
      // Trigger calendar refresh event
      CalendarRefreshUtils.triggerNotionRefresh(calendar.id, notionEvents.length, true, `Synced ${notionEvents.length} events`);

    } catch (error) {
      console.error('Error syncing calendar:', error);
      setSyncStatus(prev => ({ ...prev, [calendar.id]: 'error' }));

      if (error instanceof NotionApiError) {
        if (error.code === 'cors_blocked' || error.code === 'network' || error.code === 'timeout') {
          enqueueRetry(calendar.id);
        }
      }
      
      toast({
        title: "Sync Failed",
        description: `Failed to sync ${calendar.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });

      // Trigger calendar refresh event for error case
      CalendarRefreshUtils.triggerNotionRefresh(calendar.id, 0, false, error instanceof Error ? error.message : 'Sync failed');

      throw error;
    }
  }, [buildIncrementalFilter, enqueueRetry, getDatabaseMetadata, loadEvents, toast, transformPages, updateCalendar]);

  // Public API with rate limiting + per-calendar debounce
  const syncCalendar = useCallback(async (calendar: NotionScrapedCalendar) => {
    if (!notionRateLimiterRef.tryRemove()) {
      toast({
        title: 'Rate Limited',
        description: 'Too many Notion syncs quickly. Please wait a few seconds.',
        variant: 'destructive'
      });
      return;
    }
    let debounced = debouncedSyncRef.get(calendar.id);
    if (!debounced) {
      debounced = createDebounce(async () => {
        try { await performSyncCalendar(calendar); } catch { /* handled internally */ }
      }, 500);
      debouncedSyncRef.set(calendar.id, debounced);
    }
    debounced();
  }, [performSyncCalendar, debouncedSyncRef, notionRateLimiterRef, toast]);

  const drainRetryQueue = useCallback(async () => {
    let queue: string[] = [];
    try {
      queue = JSON.parse(localStorage.getItem(RETRY_QUEUE_KEY) || '[]') as string[];
      if (!queue.length) return;
      localStorage.removeItem(RETRY_QUEUE_KEY);
    } catch (error) {
      console.warn('Failed to read Notion retry queue', error);
      return;
    }

    for (const calendarId of queue) {
      const calendar = calendars.find(cal => cal.id === calendarId);
      if (calendar && calendar.enabled) {
        await syncCalendar(calendar);
      }
    }
  }, [calendars, syncCalendar]);

  // Sync all enabled calendars
  const syncAllCalendars = useCallback(async () => {
    if (!notionRateLimiterRef.tryRemove()) {
      toast({
        title: 'Rate Limited',
        description: 'Bulk sync throttled. Try again shortly.',
        variant: 'destructive'
      });
      return;
    }
    setIsLoading(true);
    const enabledCalendars = calendars.filter(cal => cal.enabled);
    let successCount = 0;
    const totalCount = enabledCalendars.length;

    try {
      await Promise.all(
        enabledCalendars.map(async (calendar) => {
          try {
            await performSyncCalendar(calendar);
            successCount++;
          } catch (error) {
            console.error(`Failed to sync calendar ${calendar.name}:`, error);
          }
        })
      );
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${successCount}/${totalCount} calendars`,
      });
      
      // Trigger refresh for all calendars sync completion
      CalendarRefreshUtils.triggerAllRefresh(
        successCount === totalCount, 
        `Synced ${successCount}/${totalCount} Notion calendars`
      );
    } catch (error) {
      console.error('Error syncing all calendars:', error);
      // Individual error messages are handled in syncCalendar
    } finally {
      setIsLoading(false);
    }
  }, [calendars, notionRateLimiterRef, performSyncCalendar, toast]);

  // Validate a Notion integration and database
  const validateNotionUrl = useCallback(async (
    url: string,
    token?: string,
    connectionMode: 'api' | 'public' = 'api'
  ): Promise<{ isValid: boolean; error?: string; code?: string }> => {
    const parsed = notionPageScraper.parseNotionUrl(url);
    if (!parsed) {
      recordSetupAttempt({ url, result: 'error', error: 'Invalid Notion database URL', code: 'invalid_url' });
      return { isValid: false, error: 'Invalid Notion database URL', code: 'invalid_url' };
    }
    if (connectionMode === 'public') {
      recordSetupAttempt({ url, result: 'success' });
      return { isValid: true };
    }
    if (!token) {
      recordSetupAttempt({ url, result: 'error', error: 'Notion integration token is required', code: 'missing_token' });
      return { isValid: false, error: 'Notion integration token is required', code: 'missing_token' };
    }
    try {
      await notionAPIClient.getIntegrationInfo(token);
      await notionAPIClient.getDatabase(parsed.blockId, token);
      await notionAPIClient.queryDatabase(parsed.blockId, token, { page_size: 1 });
      recordSetupAttempt({ url, result: 'success' });
      return { isValid: true };
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'Validation failed';
      const code = err instanceof NotionApiError ? err.code : 'unknown';
      if (code === 'cors_blocked') {
        errorMessage = 'This device blocked the Notion API request (CORS). Switch to Public shared page mode.';
      }
      recordSetupAttempt({ url, result: 'error', error: errorMessage, code });
      return { isValid: false, error: errorMessage, code };
    }
  }, []);

  // Test database access
  const testDatabaseAccess = useCallback(async (token: string, databaseId: string) => {
    try {
      const db = await notionAPIClient.getDatabase(databaseId, token);
      return { success: true, id: db.id };
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to test database access');
    }
  }, []);

  // Get events for filtering
  const getScrapedEvents = useCallback(() => {
    return events;
  }, [events]);

  // Initialize background sync when calendars are loaded
  useEffect(() => {
    if (calendars.length > 0 && isBackgroundSyncSupported) {
      const initBackgroundSync = async () => {
        try {
          await registerBackgroundSync();
          await registerPeriodicSync();
          // debug removed: background sync initialized for Notion calendars
        } catch (error) {
          console.error('Failed to initialize background sync for Notion calendars:', error);
        }
      };
      
      initBackgroundSync();
    }
  }, [calendars.length, isBackgroundSyncSupported, registerBackgroundSync, registerPeriodicSync]);

  // Initialize
  useEffect(() => {
    loadCalendars();
    loadEvents();
  }, [loadCalendars, loadEvents]);

  // Replay retry queue when app returns to foreground or network is back
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        drainRetryQueue();
      }
    };
    const handleOnline = () => {
      drainRetryQueue();
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [drainRetryQueue]);

  // Auto-sync scheduler for Notion calendars based on syncFrequencyPerDay
  useEffect(() => {
    const notionTimerWindow = window as Window & { __notionAutoSyncTimers?: Map<string, number> };
    if (!notionTimerWindow.__notionAutoSyncTimers) {
      notionTimerWindow.__notionAutoSyncTimers = new Map<string, number>();
    }
    const timers = notionTimerWindow.__notionAutoSyncTimers;

    // Clear timers for calendars no longer applicable
    timers.forEach((timeoutId, calId) => {
      const cal = calendars.find(c => c.id === calId);
      if (!cal || !cal.enabled || !cal.syncFrequencyPerDay) {
        clearTimeout(timeoutId);
        timers.delete(calId);
      }
    });

    calendars.forEach(calendar => {
      if (!calendar.enabled || !calendar.syncFrequencyPerDay || calendar.syncFrequencyPerDay <= 0) return;
      if (timers.has(calendar.id)) return; // already scheduled
      const intervalHours = 24 / calendar.syncFrequencyPerDay;
      const intervalMs = intervalHours * 60 * 60 * 1000;
      const scheduleNext = () => {
        const id = window.setTimeout(async () => {
          try {
            const latest = calendars.find(c => c.id === calendar.id);
            if (latest && latest.enabled) {
              await syncCalendar(latest);
            }
          } catch (e) {
            console.warn('Notion auto-sync failed', calendar.id, e);
          } finally {
            timers.delete(calendar.id);
            scheduleNext();
          }
        }, intervalMs);
        timers.set(calendar.id, id);
      };
      // Spread initial load with jitter up to 10% of interval (max 5m)
      const initialDelay = Math.min(intervalMs * 0.1, 5 * 60 * 1000) * Math.random();
      const firstId = window.setTimeout(async () => {
        try {
          const latest = calendars.find(c => c.id === calendar.id);
          if (latest && latest.enabled) {
            await syncCalendar(latest);
          }
        } catch (e) {
          console.warn('Initial Notion auto-sync failed', calendar.id, e);
        } finally {
          timers.delete(calendar.id);
          scheduleNext();
        }
      }, initialDelay);
      timers.set(calendar.id, firstId);
    });
  }, [calendars, syncCalendar]);

  return {
    calendars,
    events,
    isLoading,
    syncStatus,
    addCalendar,
    updateCalendar,
    removeCalendar,
    syncCalendar,
    syncAllCalendars,
    validateNotionUrl,
    testDatabaseAccess,
    getScrapedEvents
  };
};
