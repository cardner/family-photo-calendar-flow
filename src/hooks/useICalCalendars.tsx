import { useState, useEffect, useCallback } from 'react';
import { generateOccurrenceId } from '@/utils/icalEventUtils';
import ICAL from 'ical.js';
import { calendarStorageService } from '@/services/calendarStorage';
import { useBackgroundSync } from './useBackgroundSync';
import { CalendarRefreshUtils } from './useCalendarRefresh';

export interface ICalCalendar {
  id: string;
  name: string;
  url: string;
  color: string;
  enabled: boolean;
  lastSync?: string;
  eventCount?: number;
  // Number of automatic syncs per day (0/undefined = manual only)
  syncFrequencyPerDay?: number;
}

export interface ICalEventOccurrence {
  id: string;
  title: string;
  time: string;
  location: string;
  attendees: number;
  category: 'Personal';
  color: string;
  description: string;
  organizer: string;
  date: Date;
  calendarId: string;
  calendarName: string;
  source: 'ical';
  isMultiDay: boolean;
}

const ICAL_EVENTS_KEY = 'family_calendar_ical_events';

// Multiple CORS proxy options for better reliability
const CORS_PROXIES = [
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://cors-anywhere.herokuapp.com/${url}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  (url: string) => `https://cors.bridged.cc/${url}`,
];

// Optional custom proxy (e.g. Supabase Edge Function or self-hosted) configured via Vite env
// Provide a URL where the raw ICS feed can be fetched with ?url= encoded param or path style
interface ViteEnvLike { VITE_ICAL_PROXY_URL?: string; DEV?: boolean }
// Narrow import.meta typing to avoid any
const CUSTOM_ICAL_PROXY = (typeof import.meta !== 'undefined' ? (import.meta as unknown as { env: ViteEnvLike }).env?.VITE_ICAL_PROXY_URL : '') || '';

// Basic normalization & sanity validation to avoid sending obviously invalid tokens like 'Family'
const normalizeICalUrl = (raw: string): { url: string; valid: boolean; reason?: string } => {
  if (!raw) return { url: raw, valid: false, reason: 'Empty URL' };
  let trimmed = raw.trim();
  // Remove surrounding angle brackets sometimes copied from mail clients
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  // If no scheme but looks like domain/path, prepend https://
  if (!/^https?:\/\//i.test(trimmed) && /[.]/.test(trimmed.split(/[\s/?#]/)[0])) {
    trimmed = 'https://' + trimmed;
  }
  // Reject if contains whitespace (likely copy error)
  if (/\s/.test(trimmed)) {
    return { url: trimmed, valid: false, reason: 'Whitespace detected in URL' };
  }
  try {
    const u = new URL(trimmed);
    if (!u.hostname.includes('.')) {
      return { url: trimmed, valid: false, reason: 'Hostname missing dot' };
    }
    return { url: u.toString(), valid: true };
  } catch {
    return { url: trimmed, valid: false, reason: 'Malformed URL' };
  }
};

export const useICalCalendars = () => {
  const [calendars, setCalendars] = useState<ICalCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  type SyncState = '' | 'syncing' | 'success' | 'error';
  const [syncStatus, setSyncStatus] = useState<Record<string, SyncState>>({});
  // Deterministic occurrence ID generation for better update detection

  // Deterministic ID for already stored event objects (no UID available)
  interface LegacyStoredEventLike {
    id?: string;
    calendarId: string;
    title: string;
    date: string | Date;
    isMultiDay?: boolean;
    [k: string]: unknown;
  }

  // Minimal shape used for deterministic ID regeneration when legacy events lacked UID
  const generateStoredEventId = useCallback((e: LegacyStoredEventLike): string => {
    const dateObj = typeof e.date === 'string' ? new Date(e.date) : e.date;
    // Cast only the tiny piece we need instead of whole event as any
    const pseudoEvent: Pick<ICAL.Event, 'uid' | 'summary'> = { uid: undefined as unknown as string, summary: e.title as unknown as string };
    return generateOccurrenceId(pseudoEvent, { id: e.calendarId }, dateObj, !!e.isMultiDay);
  }, []);

  // One-time migration of legacy random IDs to deterministic IDs
  useEffect(() => {
    try {
      const storedRaw = localStorage.getItem(ICAL_EVENTS_KEY);
      if (!storedRaw) return;
  const parsed: LegacyStoredEventLike[] = JSON.parse(storedRaw) as LegacyStoredEventLike[];
      let changed = false;
      const migrated = parsed.map(ev => {
        if (ev && typeof ev === 'object') {
          const hasDeterministic = typeof ev.id === 'string' && ev.id.startsWith('ical_');
          if (!hasDeterministic && ev.calendarId && ev.title && ev.date) {
            const newId = generateStoredEventId({ calendarId: ev.calendarId, title: ev.title, date: ev.date, isMultiDay: ev.isMultiDay });
            if (newId !== ev.id) {
              changed = true;
              return { ...ev, id: newId };
            }
          }
        }
        return ev;
      });
      if (changed) {
        localStorage.setItem(ICAL_EVENTS_KEY, JSON.stringify(migrated));
      }
    } catch (mErr) {
      console.warn('iCal legacy ID migration failed:', mErr);
    }
  }, [generateStoredEventId]);
  const { 
    registerBackgroundSync, 
    registerPeriodicSync, 
    triggerBackgroundSync,
    isBackgroundSyncSupported,
    processSyncQueue
  } = useBackgroundSync();

  // Helper functions defined first to avoid temporal dead zone issues
  const isEventInCurrentYear = useCallback((eventDate: Date): boolean => {
    const currentYear = new Date().getFullYear();
    return eventDate.getFullYear() === currentYear;
  }, []);

  const isMultiDayEvent = useCallback((event: ICAL.Event): boolean => {
    try {
      if (!event.startDate || !event.endDate) {
        return false;
      }

      if (event.startDate.isDate && event.endDate.isDate) {
        const startDate = event.startDate.toJSDate();
        const endDate = event.endDate.toJSDate();
        
        const diffTime = endDate.getTime() - startDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays > 1;
      }

      return false;
    } catch (error) {
      console.warn('Error checking if event is multi-day:', error);
      return false;
    }
  }, []);

  const createEventObject = useCallback((event: ICAL.Event, calendar: ICalCalendar, eventDate: Date, isRecurring: boolean, isMultiDay: boolean): ICalEventOccurrence => {
    let timeString = 'All day';
    
    try {
      if (event.startDate && !event.startDate.isDate) {
        const endDate = event.endDate ? event.endDate.toJSDate() : eventDate;
        timeString = `${eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (isMultiDay) {
        timeString = 'All day (Multi-day)';
      }
    } catch (dateError) {
      console.warn('Error parsing event date:', dateError);
    }

    if (isRecurring && !timeString.includes('Recurring')) {
      timeString = `${timeString} (Recurring)`;
    }

  return {
      id: generateOccurrenceId(event, calendar, eventDate, isMultiDay),
      title: (event.summary as string) || 'Untitled Event',
      time: timeString,
      location: (event.location as string) || '',
      attendees: 0,
      category: 'Personal' as const,
      color: calendar.color,
      description: (event.description as string) || '',
      organizer: calendar.name,
      date: eventDate,
      calendarId: calendar.id,
      calendarName: calendar.name,
      source: 'ical',
      isMultiDay: isMultiDay
    };
  }, []);

  const generateMultiDayOccurrences = useCallback((event: ICAL.Event, calendar: ICalCalendar): ICalEventOccurrence[] => {
    const occurrences: ICalEventOccurrence[] = [];
    
    try {
      if (!isMultiDayEvent(event)) {
        const eventDate = event.startDate.toJSDate();
        if (isEventInCurrentYear(eventDate)) {
          occurrences.push(createEventObject(event, calendar, eventDate, false, false));
        }
        return occurrences;
      }

      const startDate = event.startDate.toJSDate();
      const endDate = event.endDate.toJSDate();
      
      const currentDate = new Date(startDate);
      while (currentDate < endDate && isEventInCurrentYear(currentDate)) {
        occurrences.push(createEventObject(event, calendar, new Date(currentDate), false, true));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
  // debug removed: generated multi-day occurrences
    } catch (error) {
      console.warn('Error generating multi-day occurrences:', error);
      const eventDate = event.startDate ? event.startDate.toJSDate() : new Date();
      if (isEventInCurrentYear(eventDate)) {
        occurrences.push(createEventObject(event, calendar, eventDate, false, false));
      }
    }

    return occurrences;
  }, [createEventObject, isMultiDayEvent, isEventInCurrentYear]);

  // Function to expand recurring events
  const expandRecurringEvent = useCallback((event: ICAL.Event, calendar: ICalCalendar): ICalEventOccurrence[] => {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
  const occurrences: ICalEventOccurrence[] = [];

    try {
      if (event.isRecurring()) {
        const iterator = event.iterator();
        let next;
        let count = 0;
        const maxOccurrences = 366;

        while ((next = iterator.next()) && count < maxOccurrences) {
          const occurrenceDate = next.toJSDate();
          
          if (occurrenceDate >= yearStart && occurrenceDate <= yearEnd) {
            if (isMultiDayEvent(event)) {
              const multiDayOccurrences = generateMultiDayOccurrences(event, calendar);
              occurrences.push(...multiDayOccurrences);
            } else {
              occurrences.push(createEventObject(event, calendar, occurrenceDate, true, false));
            }
          }
          
          if (occurrenceDate > yearEnd) {
            break;
          }
          
          count++;
        }
      } else {
        const multiDayOccurrences = generateMultiDayOccurrences(event, calendar);
        occurrences.push(...multiDayOccurrences);
      }
    } catch (error) {
      console.warn('Error expanding recurring event:', error);
      const eventDate = event.startDate ? event.startDate.toJSDate() : new Date();
      if (isEventInCurrentYear(eventDate)) {
        occurrences.push(createEventObject(event, calendar, eventDate, false, false));
      }
    }

    return occurrences;
  }, [generateMultiDayOccurrences, isMultiDayEvent, createEventObject, isEventInCurrentYear]);

  // Load calendars from IndexedDB
  const loadCalendars = useCallback(async () => {
    try {
  const storedCalendars = await calendarStorageService.getAllCalendars();
      setCalendars(storedCalendars);
      return storedCalendars;
    } catch (error) {
      console.error('Error loading calendars from IndexedDB:', error);
      setCalendars([]);
      return [];
    }
  }, []);

  // Update an existing calendar
  const updateCalendar = useCallback(async (id: string, updates: Partial<ICalCalendar>) => {
    try {
      await calendarStorageService.updateCalendar(id, updates);
      await loadCalendars(); // Refresh the state
    } catch (error) {
      console.error('Error updating calendar in IndexedDB:', error);
      throw new Error('Failed to update calendar');
    }
  }, [loadCalendars]);

  interface BackgroundSyncData { calendarId: string; icalData: string; syncTime: string }
  const processBackgroundSyncData = useCallback((syncData: BackgroundSyncData) => {
    try {
      const { calendarId, icalData, syncTime } = syncData;
      
      // Find the calendar
      const calendar = calendars.find(cal => cal.id === calendarId);
      if (!calendar) return;

      // Parse the iCal data
      const jcalData = ICAL.parse(icalData);
      const vcalendar = new ICAL.Component(jcalData);
      const vevents = vcalendar.getAllSubcomponents('vevent');

  const allEvents: ICalEventOccurrence[] = [];
      vevents.forEach((vevent) => {
        const event = new ICAL.Event(vevent);
        const eventOccurrences = expandRecurringEvent(event, calendar);
        allEvents.push(...eventOccurrences);
      });

      // Update events in localStorage
  const existingEvents: ICalEventOccurrence[] = JSON.parse(localStorage.getItem(ICAL_EVENTS_KEY) || '[]');
  const filteredExisting = existingEvents.filter((event) => event.calendarId !== calendarId);
      
      // Track sync changes for better reporting
  // debug removed: sync counts for iCal calendar
      
      const combinedEvents = [...filteredExisting, ...allEvents];
      localStorage.setItem(ICAL_EVENTS_KEY, JSON.stringify(combinedEvents));

      // Update calendar sync status
      updateCalendar(calendarId, {
        lastSync: syncTime,
        eventCount: allEvents.length
      });

  // debug removed: background sync processed events
      
      // Trigger calendar refresh event for background sync
      CalendarRefreshUtils.triggerICalRefresh(calendarId, allEvents.length, true, `Background sync completed`);
    } catch (error) {
      console.error('Error processing background sync data:', error);
    }
  }, [calendars, expandRecurringEvent, updateCalendar]);

  // Initialize background sync when calendars are loaded
  useEffect(() => {
    if (calendars.length > 0 && isBackgroundSyncSupported) {
      const initBackgroundSync = async () => {
        try {
          await registerBackgroundSync();
          await registerPeriodicSync();
          // debug removed: background sync initialized for calendar feeds
        } catch (error) {
          console.error('Failed to initialize background sync:', error);
        }
      };
      
      initBackgroundSync();
    }
  }, [calendars.length, isBackgroundSyncSupported, registerBackgroundSync, registerPeriodicSync]);

  // Listen for background sync data
  useEffect(() => {
    const handleBackgroundSyncData = (event: CustomEvent) => {
      const { syncQueue } = event.detail;
      
      // Process background sync results
  syncQueue.forEach((syncData: BackgroundSyncData) => {
        try {
          processBackgroundSyncData(syncData);
        } catch (error) {
          console.error('Error processing background sync data:', error);
        }
      });
    };

    window.addEventListener('background-sync-data-available', handleBackgroundSyncData as EventListener);
    
    return () => {
      window.removeEventListener('background-sync-data-available', handleBackgroundSyncData as EventListener);
    };
  }, [processBackgroundSyncData]);

  // Add a new iCal calendar
  // Allow optional syncFrequencyPerDay when adding
  const addCalendar = useCallback(async (calendar: Omit<ICalCalendar, 'id'> & { syncFrequencyPerDay?: number }) => {
    if (!calendar.name || !calendar.url) {
      throw new Error('Calendar name and URL are required');
    }
    
    const trimmedUrl = calendar.url.trim();
    if (!trimmedUrl) {
      throw new Error('Calendar URL cannot be empty');
    }
    
    // Check for duplicates
    const existingCalendars = await calendarStorageService.getAllCalendars();
    const existingByName = existingCalendars.find(cal => 
      cal.name.toLowerCase().trim() === calendar.name.toLowerCase().trim()
    );
    const existingByUrl = existingCalendars.find(cal => 
      cal.url.toLowerCase().trim() === trimmedUrl.toLowerCase().trim()
    );

    if (existingByName) {
      throw new Error('A calendar with this name already exists');
    }
    if (existingByUrl) {
      throw new Error('A calendar with this URL already exists');
    }
    
    const newCalendar: ICalCalendar = {
      id: `ical_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: calendar.name.trim(),
      url: trimmedUrl,
      color: calendar.color || '#3b82f6',
      enabled: calendar.enabled !== undefined ? calendar.enabled : true,
      eventCount: 0,
      syncFrequencyPerDay: calendar.syncFrequencyPerDay ?? 0,
    };
    
    try {
      await calendarStorageService.addCalendar(newCalendar);
      await loadCalendars(); // Refresh the state
      
      // Schedule background sync for the new calendar
      if (isBackgroundSyncSupported) {
        await triggerBackgroundSync();
      }
      
      return newCalendar;
    } catch (error) {
      console.error('Error saving calendar to IndexedDB:', error);
      throw new Error('Failed to save calendar to database');
    }
  }, [loadCalendars, isBackgroundSyncSupported, triggerBackgroundSync]);

  // Remove a calendar and clean up all related data
  const removeCalendar = useCallback(async (id: string) => {
    try {
      await calendarStorageService.deleteCalendar(id);
      
      // Immediately update the local state to remove the calendar from UI
      setCalendars(prev => prev.filter(cal => cal.id !== id));
      
      // Clean up sync status
      setSyncStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[id];
        return newStatus;
      });
      
      // Remove events from this calendar from localStorage
      try {
        const storedEvents = localStorage.getItem(ICAL_EVENTS_KEY);
        if (storedEvents) {
          const events: ICalEventOccurrence[] = JSON.parse(storedEvents) as ICalEventOccurrence[];
          const filteredEvents = events.filter((event) => event.calendarId !== id);
          localStorage.setItem(ICAL_EVENTS_KEY, JSON.stringify(filteredEvents));
          // debug removed: calendar events removed from localStorage
        }
      } catch (error) {
        console.error('Error removing calendar events:', error);
      }
      
      // Force a refresh to ensure everything is in sync
      await loadCalendars();
      
  // debug removed: calendar fully removed
    } catch (error) {
      console.error('Error removing calendar from IndexedDB:', error);
      throw new Error('Failed to remove calendar');
    }
  }, [loadCalendars]);

  // Validate iCal data format
  const isValidICalData = useCallback((data: string): boolean => {
    if (!data || typeof data !== 'string') {
      return false;
    }

    const errorIndicators = [
      'offline', 'error', 'not found', '404', '500', '503',
      'access denied', 'forbidden', 'unauthorized', 'timeout',
      'maintenance', 'unavailable'
    ];
    
    const lowerData = data.toLowerCase().trim();
    
    if (data.length < 50 && errorIndicators.some(indicator => lowerData.includes(indicator))) {
  console.warn('Potential iCal error message detected');
      return false;
    }

    const hasVCalendar = lowerData.includes('begin:vcalendar');
    
    if (!hasVCalendar) {
  console.warn('iCal data missing BEGIN:VCALENDAR');
      return false;
    }

    return true;
  }, []);

  const fetchICalData = useCallback(async (url: string): Promise<string> => {
    // Normalize / validate upfront
    const { url: normalized, valid, reason } = normalizeICalUrl(url);
    if (!valid) {
      throw new Error(`Invalid iCal URL: ${reason || 'Unknown reason'}`);
    }
    const targetUrl = normalized;
    try {
      const response = await fetch(targetUrl, {
        mode: 'cors',
        headers: {
          'Accept': 'text/calendar, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (compatible; FamilyCalendarApp/1.0)',
        }
      });
      
      if (response.ok) {
        const data = await response.text();
        
        if (isValidICalData(data)) {
          return data;
        } else {
      console.warn('Direct fetch returned invalid iCal data');
        }
      }
    } catch (error) {
    console.warn('Direct fetch failed, trying proxies');
    }

    // Try custom proxy first if configured
    if (CUSTOM_ICAL_PROXY) {
      try {
        const proxyEndpoint = CUSTOM_ICAL_PROXY.includes('{url}')
          ? CUSTOM_ICAL_PROXY.replace('{url}', encodeURIComponent(targetUrl))
          : `${CUSTOM_ICAL_PROXY}${CUSTOM_ICAL_PROXY.includes('?') ? '&' : '?'}url=${encodeURIComponent(targetUrl)}`;
        const proxyResp = await fetch(proxyEndpoint, { headers: { 'Accept': 'text/calendar, text/plain, */*' } });
        if (proxyResp.ok) {
          const data = await proxyResp.text();
          if (isValidICalData(data)) {
            return data;
          } else {
            console.warn('Custom proxy returned invalid iCal data');
          }
        } else {
          console.warn('Custom proxy request failed with status', proxyResp.status);
        }
      } catch (e) {
        console.warn('Custom proxy request failed');
      }
    }

    for (let i = 0; i < CORS_PROXIES.length; i++) {
      try {
        const proxyUrl = CORS_PROXIES[i](targetUrl);
        
        const response = await fetch(proxyUrl, {
          headers: {
            'Accept': 'text/calendar, text/plain, */*',
          }
        });

        if (response.ok) {
          const data = await response.text();
          
          if (isValidICalData(data)) {
            return data;
          } else {
            console.warn(`Proxy ${i + 1} returned invalid iCal data`);
          }
        } else {
          console.warn(`Proxy ${i + 1} failed with status ${response.status}`);
        }
      } catch (error) {
        console.warn(`Proxy ${i + 1} failed`);
      }
    }

    throw new Error('All fetch methods failed or returned invalid data. Please check if the iCal URL is publicly accessible and returns valid calendar data.');
  }, [isValidICalData]);

  const syncCalendar = useCallback(async (calendar: ICalCalendar) => {
    setIsLoading(true);
    setSyncStatus(prev => ({ ...prev, [calendar.id]: 'syncing' }));
  CalendarRefreshUtils.triggerICalRefreshStart(calendar.id);

    try {
      if (!calendar.url || calendar.url.trim() === '') {
        throw new Error('Calendar does not have a valid URL for syncing.');
      }

      const icalData = await fetchICalData(calendar.url);
      
      if (!icalData || icalData.trim().length === 0) {
        throw new Error('Received empty calendar data');
      }

      let jcalData;
      try {
        jcalData = ICAL.parse(icalData);
      } catch (parseError) {
        console.error('ICAL parsing error:', parseError);
        throw new Error(`Invalid calendar format: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
      }

      const vcalendar = new ICAL.Component(jcalData);
      const vevents = vcalendar.getAllSubcomponents('vevent');

  // debug removed: processing events count

  const allEvents: ICalEventOccurrence[] = [];
      vevents.forEach((vevent) => {
        const event = new ICAL.Event(vevent);
        const eventOccurrences = expandRecurringEvent(event, calendar);
        allEvents.push(...eventOccurrences);
      });

  // debug removed: expansion details

      try {
  const existingEvents = JSON.parse(localStorage.getItem(ICAL_EVENTS_KEY) || '[]') as (ICalEventOccurrence & { date: string | Date })[];
  const filteredExisting = existingEvents.filter((event) => event.calendarId !== calendar.id);
        
        // Create a map for efficient event comparison by a stable identifier
  const existingEventMap = new Map<string, ICalEventOccurrence & { date: string | Date }>();
        filteredExisting.forEach(event => {
          // Support both legacy random ids and new deterministic ids
          const legacyKey = `${event.calendarId}-${event.title}-${event.date}`;
          existingEventMap.set(legacyKey, event);
          if (event.id) existingEventMap.set(String(event.id), event);
        });
        
        // Track which events are new, updated, or unchanged
  const updatedEvents: ICalEventOccurrence[] = [];
        let newCount = 0;
        let updatedCount = 0;
        
        allEvents.forEach(newEvent => {
          const eventKey = `${newEvent.calendarId}-${newEvent.title}-${newEvent.date}`;
          const existingEvent = existingEventMap.get(newEvent.id) || existingEventMap.get(eventKey);
          
          if (!existingEvent) {
            // New event
            updatedEvents.push(newEvent);
            newCount++;
          } else {
            // Check if event details have changed
            const hasChanges = 
              existingEvent.description !== newEvent.description ||
              existingEvent.location !== newEvent.location ||
              existingEvent.time !== newEvent.time ||
              existingEvent.organizer !== newEvent.organizer;
            
            if (hasChanges) {
              // Event has been updated
              updatedEvents.push({ ...newEvent, id: existingEvent.id }); // Preserve original ID
              updatedCount++;
            } else {
              // Event unchanged
              updatedEvents.push(existingEvent);
            }
            
            // Remove from map to track which events were deleted
            existingEventMap.delete(eventKey);
            existingEventMap.delete(newEvent.id);
          }
        });
        
        // Combine with events from other calendars
        const combinedEvents = [...filteredExisting, ...updatedEvents];
        localStorage.setItem(ICAL_EVENTS_KEY, JSON.stringify(combinedEvents));
        
  // debug removed: calendar sync counts
      } catch (error) {
        console.error('Error storing iCal events:', error);
      }

      await updateCalendar(calendar.id, {
        lastSync: new Date().toISOString(),
        eventCount: allEvents.length
      });

      setSyncStatus(prev => ({ ...prev, [calendar.id]: 'success' }));
  // debug removed: successful sync summary
      
      // Trigger calendar refresh event
      CalendarRefreshUtils.triggerICalRefresh(calendar.id, allEvents.length, true, `Synced ${allEvents.length} events`);
      
      return allEvents;

    } catch (error) {
      console.error('Error syncing iCal calendar:', error);
      setSyncStatus(prev => ({ ...prev, [calendar.id]: 'error' }));
      
      // Trigger calendar refresh event for error case
      CalendarRefreshUtils.triggerICalRefresh(calendar.id, 0, false, error instanceof Error ? error.message : 'Sync failed');
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [updateCalendar, expandRecurringEvent, fetchICalData]);

  const syncAllCalendars = useCallback(async () => {
    const enabledCalendars = calendars.filter(cal => cal.enabled);
    
  // Emit bulk start event
  CalendarRefreshUtils.triggerAllRefreshStart();

    // Try background sync first if supported
    if (isBackgroundSyncSupported && enabledCalendars.length > 0) {
      try {
        const success = await triggerBackgroundSync();
        if (success) {
          // debug removed: background sync trigger for all calendars
          return;
        }
      } catch (error) {
        console.error('Background sync failed, falling back to foreground sync:', error);
      }
    }
    
    // Fallback to foreground sync
    let successCount = 0;
    const totalCount = enabledCalendars.length;
    
    for (const calendar of enabledCalendars) {
      try {
        await syncCalendar(calendar);
        successCount++;
      } catch (error) {
        console.error(`Failed to sync calendar ${calendar.name}:`, error);
      }
    }
    
    // Trigger refresh for all calendars sync completion
    CalendarRefreshUtils.triggerAllRefresh(
      successCount === totalCount, 
      `Synced ${successCount}/${totalCount} calendars`
    );
  }, [calendars, syncCalendar, isBackgroundSyncSupported, triggerBackgroundSync]);

  // Auto-sync scheduler: sets timeouts per calendar based on frequency
  useEffect(() => {
    // Clear existing timers stored on window to avoid duplication
    const timerWindow = window as Window & { __icalAutoSyncTimers?: Map<string, number> };
    if (!timerWindow.__icalAutoSyncTimers) {
      timerWindow.__icalAutoSyncTimers = new Map<string, number>();
    }
    const timers = timerWindow.__icalAutoSyncTimers;
    // Clear timers for calendars that no longer exist or frequency changed to 0
    timers.forEach((timeoutId, calId) => {
      const calendar = calendars.find(c => c.id === calId);
      if (!calendar || !calendar.enabled || !calendar.syncFrequencyPerDay) {
        clearTimeout(timeoutId);
        timers.delete(calId);
      }
    });

    calendars.forEach(calendar => {
      if (!calendar.enabled || !calendar.syncFrequencyPerDay || calendar.syncFrequencyPerDay <= 0) return;
      const existing = timers.get(calendar.id);
      if (existing) return; // already scheduled
      const intervalHours = 24 / calendar.syncFrequencyPerDay;
      const intervalMs = intervalHours * 60 * 60 * 1000;
      // Stagger first run slightly after mount to avoid burst; schedule next after each completion
      const scheduleNext = () => {
        const id = window.setTimeout(async () => {
          try {
            const latest = calendars.find(c => c.id === calendar.id);
            if (latest && latest.enabled) {
              await syncCalendar(latest);
            }
          } catch (e) {
            console.warn('Auto-sync failed for calendar', calendar.id, e);
          } finally {
            // Reschedule
            timers.delete(calendar.id);
            scheduleNext();
          }
        }, intervalMs);
        timers.set(calendar.id, id);
      };
      // Initial schedule uses a randomized jitter up to 10% of interval to spread load
      const initialDelay = Math.min(intervalMs * 0.1, 5 * 60 * 1000) * Math.random();
      const firstId = window.setTimeout(async () => {
        try {
          const latest = calendars.find(c => c.id === calendar.id);
          if (latest && latest.enabled) {
            await syncCalendar(latest);
          }
        } catch (e) {
          console.warn('Initial auto-sync failed for calendar', calendar.id, e);
        } finally {
          timers.delete(calendar.id);
          scheduleNext();
        }
      }, initialDelay);
      timers.set(calendar.id, firstId);
    });

    return () => {
      // Do not clear timers globally on unmount of effect unless component unmounts; timers map persists
    };
  }, [calendars, syncCalendar]);

  const getICalEvents = useCallback((): ICalEventOccurrence[] => {
    try {
      const stored = localStorage.getItem(ICAL_EVENTS_KEY);
      
      if (stored) {
        const events: (ICalEventOccurrence & { date: string | Date })[] = JSON.parse(stored);
        return events.map(ev => ({ ...ev, date: new Date(ev.date) }));
      }
      return [];
    } catch (error) {
      console.error('Error loading iCal events:', error);
      return [];
    }
  }, []);

  const forceRefresh = useCallback(() => {
    loadCalendars();
    processSyncQueue();
  }, [loadCalendars, processSyncQueue]);

  useEffect(() => {
    loadCalendars();
  }, [loadCalendars]);

  return {
    calendars,
    isLoading,
    syncStatus,
    addCalendar,
    updateCalendar,
    removeCalendar,
    syncCalendar,
    syncAllCalendars,
    getICalEvents,
    forceRefresh,
    isBackgroundSyncSupported,
    triggerBackgroundSync
  };
};
