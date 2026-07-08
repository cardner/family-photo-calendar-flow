
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import CalendarHeader from './calendar/CalendarHeader';
import CalendarContent from './calendar/CalendarContent';
import { useSettings } from '@/contexts/settings/SettingsContext';
import { useWeather } from '@/contexts/weather/WeatherContext';
import { useLocalEvents } from '@/hooks/useLocalEvents';
import { useIntegratedEvents } from '@/hooks/useIntegratedEvents';
import { useCalendarRefresh } from '@/hooks/useCalendarRefresh';
import { Event } from '@/types/calendar';

interface CalendarProps {
  onNotionEventClick?: (event: Event) => void;
}

const Calendar = ({ onNotionEventClick }: CalendarProps) => {
  const { defaultView } = useSettings();
  const [view, setView] = useState<'timeline' | 'week' | 'month'>(defaultView);
  const [prevDefaultView, setPrevDefaultView] = useState(defaultView);
  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0); // triggers data recompute
  const [viewInstance, setViewInstance] = useState(0); // forces view remount for timeline/week/month
  const [barVisible, setBarVisible] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100 width
  const [fading, setFading] = useState(false);
  const rafRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);
  const removeTimeoutRef = useRef<number | null>(null);

  if (defaultView !== prevDefaultView) {
    setPrevDefaultView(defaultView);
    setView(defaultView);
  }

  const runAnimation = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const duration = 700; // ms to fill bar
    const tick = () => {
      const elapsed = performance.now() - start;
      const ratio = Math.min(1, elapsed / duration);
      // ease-out cubic for smoother end
      const eased = 1 - Math.pow(1 - ratio, 3);
      setProgress(eased * 100);
      if (ratio < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Hold full bar briefly then fade
        fadeTimeoutRef.current = window.setTimeout(() => {
          setFading(true);
          removeTimeoutRef.current = window.setTimeout(() => {
            setBarVisible(false);
            setFading(false);
            setProgress(0);
          }, 400); // fade duration
        }, 200); // hold time at 100%
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  const { getWeatherForDate } = useWeather();
  const { googleEvents, forceRefresh } = useLocalEvents(); // Now contains iCal events
  const { useRefreshListener } = useCalendarRefresh();
  
  const { filteredEvents, eventStats } = useIntegratedEvents(googleEvents, refreshKey);

  // Listen for calendar refresh events
  useRefreshListener((evt) => {
    // Start phase: show bar and animate; Complete phase: finish early if still running
    if (evt.phase === 'start') {
      forceRefresh?.();
      setRefreshKey(prev => prev + 1);
      setViewInstance(v => v + 1);
      setBarVisible(true);
      setFading(false);
      setProgress(0);
      runAnimation();
    } else if (evt.phase === 'complete') {
      // Complete: instantly fill if not already
      setProgress(100);
      // Short delay to allow width transition, then fade
      setTimeout(() => {
        setFading(true);
        setTimeout(() => {
          setBarVisible(false);
          setFading(false);
          setProgress(0);
        }, 400);
      }, 150);
    }
  });

  // Removed effect for skeleton indicator

  // (debug removed) previously logged filteredEvents and eventStats

  return (
    <div className="space-y-6 relative" key={`calendar-${refreshKey}`}> 
      {barVisible && typeof document !== 'undefined' && createPortal(
        <div
          className="calendar-progress-bar"
          aria-label="Refreshing calendars"
          style={{
            width: `${progress}%`,
            transformOrigin: 'left',
            opacity: fading ? 0 : 1,
            transition: 'opacity 400ms ease-out, width 140ms linear'
          }}
        />,
        document.body
      )}
      <CalendarHeader
        hasGoogleEvents={true} // Always pass true to show the header
        view={view}
        onViewChange={setView}
      />

      <CalendarContent
    key={`view-${view}-${viewInstance}`}
        view={view}
        events={filteredEvents}
        weekOffset={weekOffset}
        onPreviousWeek={() => setWeekOffset(prev => prev - 1)}
        onNextWeek={() => setWeekOffset(prev => prev + 1)}
        getWeatherForDate={getWeatherForDate}
        onNotionEventClick={onNotionEventClick}
      />
    </div>
  );
};

export default Calendar;
