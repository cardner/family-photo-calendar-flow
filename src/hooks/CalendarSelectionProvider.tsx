import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useICalCalendars } from './useICalCalendars';
import { useNotionScrapedCalendars } from './useNotionScrapedCalendars';
import { useCalendarRefresh } from './useCalendarRefresh';
import { CalendarSelectionContext, CalendarSelectionValue, CombinedCalendar, CalendarFromEvents } from './CalendarSelectionContext';
import type { NotionScrapedCalendar } from '@/types/notion';
import type { ICalCalendar } from './useICalCalendars';

// Type guards for discriminating calendar shapes
const isNotionScrapedCalendar = (cal: CombinedCalendar): cal is NotionScrapedCalendar => (cal as NotionScrapedCalendar).type === 'notion-scraped';
// iCal calendars have no discriminant 'type' property; ensure typical fields exist
const isICalCalendar = (cal: CombinedCalendar): cal is ICalCalendar => !('type' in cal) && 'url' in cal;

const useProvideCalendarSelection = (): CalendarSelectionValue => {
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasUserMadeSelection, setHasUserMadeSelection] = useState(false);
  const { useRefreshListener } = useCalendarRefresh();

  useEffect(() => {
    const stored = localStorage.getItem('selectedCalendarIds');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedCalendarIds(parsed);
          setHasUserMadeSelection(true);
        }
      } catch (error) {
        console.error('Failed to parse stored selectedCalendarIds:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (hasUserMadeSelection) {
      localStorage.setItem('selectedCalendarIds', JSON.stringify(selectedCalendarIds));
    }
  }, [selectedCalendarIds, hasUserMadeSelection]);

  const { calendars: iCalCalendars = [], isLoading: iCalLoading, getICalEvents } = useICalCalendars();
  const { calendars: scrapedCalendars = [], events: scrapedEvents = [], isLoading: scrapedLoading } = useNotionScrapedCalendars();

  useRefreshListener(() => {
    setRefreshKey(prev => prev + 1);
  });

  const allCalendars = useMemo<CombinedCalendar[]>(() => {
    const safeICalCalendars = Array.isArray(iCalCalendars) ? iCalCalendars : [];
    const safeScrapedCalendars = Array.isArray(scrapedCalendars) ? scrapedCalendars : [];
    return [...safeICalCalendars, ...safeScrapedCalendars];
  }, [iCalCalendars, scrapedCalendars]);

  const enabledCalendars = useMemo<CombinedCalendar[]>(() => allCalendars.filter((cal) => cal && cal.enabled), [allCalendars]);

  const calendarsFromEvents = useMemo<CalendarFromEvents[]>(() => {
    const iCalEvents = getICalEvents ? getICalEvents() : [];
    return allCalendars.map((cal: CombinedCalendar) => {
      // eslint-disable-next-line no-useless-assignment
      let eventCount = 0;
      // eslint-disable-next-line no-useless-assignment
      let hasEvents = false;
      let source: CalendarFromEvents['source'] = 'local';
      const calendarId = (cal as { id?: string }).id || '';
      if (isICalCalendar(cal)) {
        source = 'ical';
        eventCount = iCalEvents.filter((e) => e.calendarId === calendarId).length;
        hasEvents = eventCount > 0;
      } else if (isNotionScrapedCalendar(cal)) {
        source = 'notion-scraped';
        eventCount = scrapedEvents.filter((e) => e.calendarId === calendarId).length;
        hasEvents = eventCount > 0;
      } else {
        const possible = cal as Partial<CombinedCalendar> & { eventCount?: number };
        eventCount = possible.eventCount || 0;
        hasEvents = eventCount > 0;
      }
      const meta = cal as { name?: string; color?: string; lastSync?: string };
      return {
        id: calendarId,
        summary: meta?.name || 'Unnamed Calendar',
        color: meta?.color || '#3b82f6',
        primary: calendarId === 'primary',
        hasEvents,
        eventCount,
        lastSync: meta?.lastSync,
        source
      };
    });
  }, [allCalendars, getICalEvents, scrapedEvents]);

  useEffect(() => {
    if (hasUserMadeSelection) return;
    const enabledWithEventsIds = calendarsFromEvents.filter(c => c.hasEvents).map(c => c.id);
    if (enabledWithEventsIds.length > 0 && selectedCalendarIds.length === 0) {
      setSelectedCalendarIds(enabledWithEventsIds);
    }
  }, [calendarsFromEvents, hasUserMadeSelection, selectedCalendarIds.length]);

  const toggleCalendar = useCallback((calendarId: string, checked?: boolean) => {
    setHasUserMadeSelection(true);
    setSelectedCalendarIds(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      if (typeof checked === 'boolean') {
        return checked ? (safePrev.includes(calendarId) ? safePrev : [...safePrev, calendarId]) : safePrev.filter(id => id !== calendarId);
      }
      return safePrev.includes(calendarId) ? safePrev.filter(id => id !== calendarId) : [...safePrev, calendarId];
    });
  }, []);

  const selectAllCalendars = useCallback(() => {
    setHasUserMadeSelection(true);
    setSelectedCalendarIds(enabledCalendars.map((c) => c.id).filter(Boolean));
  }, [enabledCalendars]);

  const selectCalendarsWithEvents = useCallback(() => {
    setHasUserMadeSelection(true);
    setSelectedCalendarIds(calendarsFromEvents.filter(c => c.hasEvents).map(c => c.id));
  }, [calendarsFromEvents]);

  const clearAllCalendars = useCallback(() => {
    setHasUserMadeSelection(true);
    setSelectedCalendarIds([]);
  }, []);

  const updateSelectedCalendars = useCallback((ids: string[]) => {
    setHasUserMadeSelection(true);
    setSelectedCalendarIds(Array.isArray(ids) ? ids : []);
  }, []);

  const cleanupDeletedCalendar = useCallback((calendarId: string) => {
    setSelectedCalendarIds(prev => prev.filter(id => id !== calendarId));
  }, []);

  const forceRefresh = useCallback(() => setRefreshKey(p => p + 1), []);

  return {
    allCalendars,
    enabledCalendars,
    selectedCalendarIds,
    notionEvents: [],
    scrapedEvents: Array.isArray(scrapedEvents) ? scrapedEvents : [],
    calendarsFromEvents,
    isLoading: iCalLoading || scrapedLoading,
    toggleCalendar,
    selectAllCalendars,
    deselectAllCalendars: clearAllCalendars,
    setSelectedCalendarIds,
    clearAllCalendars,
    selectCalendarsWithEvents,
    updateSelectedCalendars,
    cleanupDeletedCalendar,
    forceRefresh
  };
};

export const CalendarSelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useProvideCalendarSelection();
  return <CalendarSelectionContext.Provider value={value}>{children}</CalendarSelectionContext.Provider>;
};
