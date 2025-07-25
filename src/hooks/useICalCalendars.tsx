import { useState, useEffect, useCallback } from 'react';
import ICAL from 'ical.js';
import { calendarStorageService, CalendarFeed } from '@/services/calendarStorage';
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
}

const ICAL_EVENTS_KEY = 'family_calendar_ical_events';

// Multiple CORS proxy options for better reliability
const CORS_PROXIES = [
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://cors-anywhere.herokuapp.com/${url}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  (url: string) => `https://cors.bridged.cc/${url}`,
];

export const useICalCalendars = () => {
  const [calendars, setCalendars] = useState<ICalCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ [key: string]: string }>({});
  const { 
    registerBackgroundSync, 
    registerPeriodicSync, 
    triggerBackgroundSync,
    isBackgroundSyncSupported,
    processSyncQueue
  } = useBackgroundSync();

  // Helper functions defined first to avoid temporal dead zone issues
  const isEventInCurrentYear = (eventDate: Date): boolean => {
    const currentYear = new Date().getFullYear();
    return eventDate.getFullYear() === currentYear;
  };

  const isMultiDayEvent = (event: ICAL.Event): boolean => {
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
  };

  const createEventObject = (event: ICAL.Event, calendar: ICalCalendar, eventDate: Date, isRecurring: boolean, isMultiDay: boolean) => {
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
      id: `${Date.now()}-${Math.random()}`,
      title: event.summary || 'Untitled Event',
      time: timeString,
      location: event.location || '',
      attendees: 0,
      category: 'Personal' as const,
      color: calendar.color,
      description: event.description || '',
      organizer: calendar.name,
      date: eventDate,
      calendarId: calendar.id,
      calendarName: calendar.name,
      source: 'ical',
      isMultiDay: isMultiDay
    };
  };

  const generateMultiDayOccurrences = (event: ICAL.Event, calendar: ICalCalendar): any[] => {
    const occurrences: any[] = [];
    
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
      
      console.log(`Generated ${occurrences.length} occurrences for multi-day event: ${event.summary}`);
    } catch (error) {
      console.warn('Error generating multi-day occurrences:', error);
      const eventDate = event.startDate ? event.startDate.toJSDate() : new Date();
      if (isEventInCurrentYear(eventDate)) {
        occurrences.push(createEventObject(event, calendar, eventDate, false, false));
      }
    }

    return occurrences;
  };

  // Function to expand recurring events
  const expandRecurringEvent = useCallback((event: ICAL.Event, calendar: ICalCalendar): any[] => {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
    const occurrences: any[] = [];

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
  }, []);

  // Load calendars from IndexedDB
  const loadCalendars = useCallback(async () => {
    try {
      console.log('Loading calendars from IndexedDB');
      const storedCalendars = await calendarStorageService.getAllCalendars();
      console.log('Loaded calendars from IndexedDB:', storedCalendars);
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
    console.log('Updating calendar:', id, 'with updates:', updates);
    
    try {
      await calendarStorageService.updateCalendar(id, updates);
      await loadCalendars(); // Refresh the state
      console.log('Calendar updated successfully in IndexedDB');
    } catch (error) {
      console.error('Error updating calendar in IndexedDB:', error);
      throw new Error('Failed to update calendar');
    }
  }, [loadCalendars]);

  const processBackgroundSyncData = useCallback((syncData: any) => {
    try {
      const { calendarId, icalData, syncTime } = syncData;
      
      // Find the calendar
      const calendar = calendars.find(cal => cal.id === calendarId);
      if (!calendar) return;

      // Parse the iCal data
      const jcalData = ICAL.parse(icalData);
      const vcalendar = new ICAL.Component(jcalData);
      const vevents = vcalendar.getAllSubcomponents('vevent');

      const allEvents: any[] = [];
      vevents.forEach((vevent) => {
        const event = new ICAL.Event(vevent);
        const eventOccurrences = expandRecurringEvent(event, calendar);
        allEvents.push(...eventOccurrences);
      });

      // Update events in localStorage
      const existingEvents = JSON.parse(localStorage.getItem(ICAL_EVENTS_KEY) || '[]');
      const filteredExisting = existingEvents.filter((event: any) => event.calendarId !== calendarId);
      
      // Track sync changes for better reporting
      const existingCalendarEvents = existingEvents.filter((event: any) => event.calendarId === calendarId);
      const newCount = allEvents.length - existingCalendarEvents.length;
      const removedCount = Math.max(0, existingCalendarEvents.length - allEvents.length);
      
      console.log(`iCal sync for ${calendar.name}: ${allEvents.length} total events, ${newCount > 0 ? newCount + ' new' : ''} ${removedCount > 0 ? removedCount + ' removed' : ''}`);
      
      const combinedEvents = [...filteredExisting, ...allEvents];
      localStorage.setItem(ICAL_EVENTS_KEY, JSON.stringify(combinedEvents));

      // Update calendar sync status
      updateCalendar(calendarId, {
        lastSync: syncTime,
        eventCount: allEvents.length
      });

      console.log(`Background sync processed ${allEvents.length} events for ${calendar.name}`);
      
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
          console.log('Background sync initialized for calendar feeds');
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
      syncQueue.forEach((syncData: any) => {
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
  const addCalendar = useCallback(async (calendar: Omit<ICalCalendar, 'id'>) => {
    console.log('Adding new calendar with URL:', calendar.url);
    
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
      eventCount: 0
    };
    
    console.log('New calendar object created with URL:', newCalendar.url);
    
    try {
      await calendarStorageService.addCalendar(newCalendar);
      await loadCalendars(); // Refresh the state
      
      // Schedule background sync for the new calendar
      if (isBackgroundSyncSupported) {
        await triggerBackgroundSync();
      }
      
      console.log('Calendar added successfully to IndexedDB');
      return newCalendar;
    } catch (error) {
      console.error('Error saving calendar to IndexedDB:', error);
      throw new Error('Failed to save calendar to database');
    }
  }, [loadCalendars, isBackgroundSyncSupported, triggerBackgroundSync]);

  // Remove a calendar and clean up all related data
  const removeCalendar = useCallback(async (id: string) => {
    console.log('Removing calendar:', id);
    
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
          const events = JSON.parse(storedEvents);
          const filteredEvents = events.filter((event: any) => event.calendarId !== id);
          localStorage.setItem(ICAL_EVENTS_KEY, JSON.stringify(filteredEvents));
          console.log('Calendar events removed from localStorage');
        }
      } catch (error) {
        console.error('Error removing calendar events:', error);
      }
      
      // Force a refresh to ensure everything is in sync
      await loadCalendars();
      
      console.log(`Calendar ${id} completely removed from IndexedDB and UI`);
    } catch (error) {
      console.error('Error removing calendar from IndexedDB:', error);
      throw new Error('Failed to remove calendar');
    }
  }, [loadCalendars]);

  // Validate iCal data format
  const isValidICalData = (data: string): boolean => {
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
      console.log('Data appears to be an error message:', data.substring(0, 100));
      return false;
    }

    const hasVCalendar = lowerData.includes('begin:vcalendar');
    
    if (!hasVCalendar) {
      console.log('Data does not contain BEGIN:VCALENDAR');
      return false;
    }

    return true;
  };

  const fetchICalData = async (url: string): Promise<string> => {
    console.log('Attempting to fetch iCal from:', url);
    
    try {
      const response = await fetch(url, {
        mode: 'cors',
        headers: {
          'Accept': 'text/calendar, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (compatible; FamilyCalendarApp/1.0)',
        }
      });
      
      if (response.ok) {
        const data = await response.text();
        console.log('Direct fetch successful, data length:', data.length);
        
        if (isValidICalData(data)) {
          return data;
        } else {
          console.log('Direct fetch returned invalid iCal data');
        }
      }
    } catch (error) {
      console.log('Direct fetch failed, trying proxies:', error);
    }

    for (let i = 0; i < CORS_PROXIES.length; i++) {
      try {
        const proxyUrl = CORS_PROXIES[i](url);
        console.log(`Trying proxy ${i + 1}/${CORS_PROXIES.length}:`, proxyUrl);
        
        const response = await fetch(proxyUrl, {
          headers: {
            'Accept': 'text/calendar, text/plain, */*',
          }
        });

        if (response.ok) {
          const data = await response.text();
          console.log(`Proxy ${i + 1} successful, data length:`, data.length);
          
          if (isValidICalData(data)) {
            return data;
          } else {
            console.log(`Proxy ${i + 1} returned invalid iCal data:`, data.substring(0, 100));
          }
        } else {
          console.log(`Proxy ${i + 1} failed with status:`, response.status);
        }
      } catch (error) {
        console.log(`Proxy ${i + 1} failed:`, error);
      }
    }

    throw new Error('All fetch methods failed or returned invalid data. Please check if the iCal URL is publicly accessible and returns valid calendar data.');
  };

  const syncCalendar = useCallback(async (calendar: ICalCalendar) => {
    setIsLoading(true);
    setSyncStatus(prev => ({ ...prev, [calendar.id]: 'syncing' }));

    try {
      console.log('Syncing calendar:', calendar.name, 'with URL:', calendar.url);
      
      if (!calendar.url || calendar.url.trim() === '') {
        throw new Error('Calendar does not have a valid URL for syncing.');
      }

      const icalData = await fetchICalData(calendar.url);
      
      if (!icalData || icalData.trim().length === 0) {
        throw new Error('Received empty calendar data');
      }

      console.log('Parsing iCal data, length:', icalData.length);
      
      let jcalData;
      try {
        jcalData = ICAL.parse(icalData);
      } catch (parseError) {
        console.error('ICAL parsing error:', parseError);
        throw new Error(`Invalid calendar format: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
      }

      const vcalendar = new ICAL.Component(jcalData);
      const vevents = vcalendar.getAllSubcomponents('vevent');

      console.log(`Processing ${vevents.length} events from calendar`);

      const allEvents: any[] = [];
      vevents.forEach((vevent) => {
        const event = new ICAL.Event(vevent);
        const eventOccurrences = expandRecurringEvent(event, calendar);
        allEvents.push(...eventOccurrences);
      });

      console.log(`Expanded ${vevents.length} calendar events to ${allEvents.length} occurrences`);

      try {
        const existingEvents = JSON.parse(localStorage.getItem(ICAL_EVENTS_KEY) || '[]');
        const filteredExisting = existingEvents.filter((event: any) => event.calendarId !== calendar.id);
        
        // Create a map for efficient event comparison by a stable identifier
        const existingEventMap = new Map();
        filteredExisting.forEach(event => {
          existingEventMap.set(`${event.calendarId}-${event.title}-${event.date}`, event);
        });
        
        // Track which events are new, updated, or unchanged
        const updatedEvents: any[] = [];
        let newCount = 0;
        let updatedCount = 0;
        
        allEvents.forEach(newEvent => {
          const eventKey = `${newEvent.calendarId}-${newEvent.title}-${newEvent.date}`;
          const existingEvent = existingEventMap.get(eventKey);
          
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
          }
        });
        
        // Combine with events from other calendars
        const combinedEvents = [...filteredExisting, ...updatedEvents];
        localStorage.setItem(ICAL_EVENTS_KEY, JSON.stringify(combinedEvents));
        
        console.log(`Calendar sync complete: ${newCount} new events, ${updatedCount} updated events, ${existingEventMap.size} removed events`);
      } catch (error) {
        console.error('Error storing iCal events:', error);
      }

      await updateCalendar(calendar.id, {
        lastSync: new Date().toISOString(),
        eventCount: allEvents.length
      });

      setSyncStatus(prev => ({ ...prev, [calendar.id]: 'success' }));
      console.log(`Successfully synced ${allEvents.length} event occurrences from ${calendar.name}`);
      
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
  }, [updateCalendar]); // Only include updateCalendar

  const syncAllCalendars = useCallback(async () => {
    const enabledCalendars = calendars.filter(cal => cal.enabled);
    
    // Try background sync first if supported
    if (isBackgroundSyncSupported && enabledCalendars.length > 0) {
      try {
        const success = await triggerBackgroundSync();
        if (success) {
          console.log('Background sync triggered for all calendars');
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

  const getICalEvents = useCallback(() => {
    try {
      const stored = localStorage.getItem(ICAL_EVENTS_KEY);
      console.log('Loading iCal events from localStorage:', stored ? 'Found events' : 'No events');
      
      if (stored) {
        const events = JSON.parse(stored);
        const processedEvents = events.map((event: any) => ({
          ...event,
          date: new Date(event.date)
        }));
        console.log(`Loaded ${processedEvents.length} iCal events`);
        return processedEvents;
      }
      return [];
    } catch (error) {
      console.error('Error loading iCal events:', error);
      return [];
    }
  }, []);

  const forceRefresh = useCallback(() => {
    console.log('Force refreshing iCal calendars');
    loadCalendars();
    processSyncQueue();
  }, [loadCalendars, processSyncQueue]);

  useEffect(() => {
    console.log('useICalCalendars hook initializing');
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
