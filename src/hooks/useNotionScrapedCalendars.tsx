
/**
 * Hook for managing Notion API-based calendars (formerly scraped calendars)
 */

import { useState, useEffect, useCallback } from 'react';
import { NotionScrapedCalendar, notionScrapedEventsStorage } from '@/services/notionScrapedEventsStorage';
import { NotionScrapedEvent } from '@/services/NotionPageScraper';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CalendarRefreshUtils } from '@/hooks/useCalendarRefresh';

import { useBackgroundSync } from './useBackgroundSync';

interface NotionApiEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  location?: string;
  status?: string;
  categories?: string[];
  priority?: string;
  properties?: Record<string, any>;
  sourceUrl?: string;
  scrapedAt?: string;
  endDate?: string;
  customProperties?: Record<string, any>;
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
  
  const { 
    registerBackgroundSync, 
    registerPeriodicSync, 
    triggerBackgroundSync,
    isBackgroundSyncSupported,
    processSyncQueue
  } = useBackgroundSync();

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
      console.log('Loaded Notion events:', storedEvents.length);
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

  // Sync a single calendar using Notion API
  const syncCalendar = useCallback(async (calendar: NotionScrapedCalendar) => {
    if (!calendar.metadata?.token) {
      throw new Error('Notion integration token is required for this calendar');
    }

    if (!calendar.metadata?.databaseId) {
      throw new Error('Database ID is required for this calendar');
    }

    setSyncStatus(prev => ({ ...prev, [calendar.id]: 'syncing' }));

    try {
      console.log(`🔄 Syncing Notion calendar: ${calendar.name}`);
      
      // Call the Notion API edge function
      const { data, error } = await supabase.functions.invoke('notion-api', {
        body: {
          action: 'query',
          token: calendar.metadata.token,
          databaseId: calendar.metadata.databaseId,
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to sync with Notion API');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch events from Notion');
      }

      // Transform API events to our format
      const apiEvents: NotionApiEvent[] = data.events || [];
      const notionEvents: NotionScrapedEvent[] = apiEvents.map((event: NotionApiEvent) => {
        // Extract calendar name from properties to use as title
        const calendarNameProperty = event.properties?.['calendar name'] || event.properties?.['Calendar Name'];
        const eventTitle = calendarNameProperty?.title?.[0]?.plain_text || 
                          calendarNameProperty?.rich_text?.[0]?.plain_text ||
                          calendarNameProperty?.select?.name ||
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
              if (property.rich_text && Array.isArray(property.rich_text)) {
                value = property.rich_text.map((text: any) => text.plain_text || '').join('');
              } else if (property.title && Array.isArray(property.title)) {
                value = property.title.map((text: any) => text.plain_text || '').join('');
              } else if (property.select?.name) {
                value = property.select.name;
              } else if (property.multi_select && Array.isArray(property.multi_select)) {
                value = property.multi_select.map((option: any) => option.name).join(', ');
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
        
        console.log(`Processing Notion event "${eventTitle}":`, {
          originalDate: event.date,
          parsedDate: eventDate,
          localDateString: eventDate.toDateString()
        });

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
      
      const existingEventMap = new Map();
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
            console.log(`Updating event "${newEvent.title}":`, {
              titleChanged: existingEvent.title !== newEvent.title,
              descChanged: existingEvent.description !== newEvent.description,
              locationChanged: existingEvent.location !== newEvent.location,
              statusChanged: existingEvent.status !== newEvent.status,
              timeChanged: existingEvent.time !== newEvent.time,
              dateChanged: new Date(existingEvent.date).getTime() !== new Date(newEvent.date).getTime()
            });
            return { ...newEvent, scrapedAt: new Date() }; // Update scrapedAt timestamp
          } else {
            unchangedCount++;
            return existingEvent; // Keep existing event to preserve any local state
          }
        }
      });
      
      // Calculate removed events
      const newEventIds = new Set(notionEvents.map(e => e.id));
      const removedCount = existingEvents.length - existingEvents.filter(e => newEventIds.has(e.id)).length;
      
      // Save updated events to IndexedDB
      await notionScrapedEventsStorage.saveEvents(calendar.id, processedEvents);
      
      console.log(`Notion sync details: ${newCount} new, ${updatedCount} updated, ${unchangedCount} unchanged, ${removedCount} removed`);

      // Update calendar metadata
      await updateCalendar(calendar.id, {
        lastSync: new Date().toISOString(),
        eventCount: notionEvents.length,
        metadata: {
          ...calendar.metadata,
          ...data.metadata
        }
      });

      // Reload events
      await loadEvents();

      setSyncStatus(prev => ({ ...prev, [calendar.id]: 'success' }));
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${notionEvents.length} events from ${calendar.name}`,
      });

      console.log(`✅ Synced ${notionEvents.length} events from Notion calendar: ${calendar.name}`);
      
      // Trigger calendar refresh event
      CalendarRefreshUtils.triggerNotionRefresh(calendar.id, notionEvents.length, true, `Synced ${notionEvents.length} events`);

    } catch (error) {
      console.error('Error syncing calendar:', error);
      setSyncStatus(prev => ({ ...prev, [calendar.id]: 'error' }));
      
      toast({
        title: "Sync Failed",
        description: `Failed to sync ${calendar.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });

      // Trigger calendar refresh event for error case
      CalendarRefreshUtils.triggerNotionRefresh(calendar.id, 0, false, error instanceof Error ? error.message : 'Sync failed');

      throw error;
    }
  }, [updateCalendar, loadEvents, toast]);

  // Sync all enabled calendars
  const syncAllCalendars = useCallback(async () => {
    setIsLoading(true);
    const enabledCalendars = calendars.filter(cal => cal.enabled);
    let successCount = 0;
    const totalCount = enabledCalendars.length;

    try {
      await Promise.all(
        enabledCalendars.map(async (calendar) => {
          try {
            await syncCalendar(calendar);
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
  }, [calendars, syncCalendar, toast]);

  // Validate a Notion integration and database
  const validateNotionUrl = useCallback(async (url: string, token?: string): Promise<{ isValid: boolean; error?: string }> => {
    try {
      console.log('Validating Notion integration and database...');
      
      if (!token) {
        return { isValid: false, error: 'Notion integration token is required' };
      }

      // Call the edge function to validate
      const { data, error } = await supabase.functions.invoke('notion-api', {
        body: {
          action: 'validate',
          token,
          url,
        }
      });

      if (error) {
        return { isValid: false, error: error.message || 'Validation failed' };
      }

      if (data.success) {
        console.log('Validation successful');
        return { isValid: true };
      } else {
        console.log('Validation failed:', data.error);
        return { isValid: false, error: data.error || 'Unable to access the Notion database' };
      }
    } catch (error) {
      console.error('URL validation error:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error occurred'
      };
    }
  }, []);

  // Test database access
  const testDatabaseAccess = useCallback(async (token: string, databaseId: string) => {
    const { data, error } = await supabase.functions.invoke('notion-api', {
      body: {
        action: 'test',
        token,
        databaseId,
      }
    });

    if (error) {
      throw new Error(error.message || 'Failed to test database access');
    }

    return data;
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
          console.log('Background sync initialized for Notion calendars');
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
