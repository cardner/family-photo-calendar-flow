
import React from 'react';
import { format, isToday, isTomorrow, isYesterday, addDays, startOfDay, differenceInDays, isSameDay } from 'date-fns';
import { Event } from '@/types/calendar';
import EventCard from './EventCard';
import WeatherDisplay from './WeatherDisplay';

import { compareTimeStrings } from '@/utils/timeUtils';

interface TimelineViewProps {
  events: Event[];
  getWeatherForDate: (date: Date) => { temp: number; condition: string; highTemp?: number; lowTemp?: number };
  onNotionEventClick?: (event: Event) => void;
}

const TimelineView = ({ events, getWeatherForDate, onNotionEventClick }: TimelineViewProps) => {
  try {
    // Get today and the next 6 days (total of 7 days starting from today)
    const today = new Date();
    const next7Days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
    
    // Helper function to check if an event is all-day
    const isAllDayEvent = (event: Event) => {
      try {
        return event.time === 'All day' || event.time.toLowerCase().includes('all day');
      } catch (error) {
        console.warn('Error checking if event is all-day:', error);
        return false;
      }
    };

    // Helper function to check if an event spans multiple days - VERY CONSERVATIVE
    const isMultiDayEvent = (event: Event) => {
      try {
        // Only return true if the event explicitly has isMultiDay property set to true
        return 'isMultiDay' in event && event.isMultiDay === true;
      } catch (error) {
        console.warn('Error checking if event is multi-day:', error);
        return false;
      }
    };

    // Get events for each day - STRICT date matching with proper multi-day range checking
    const getEventsForDay = (day: Date) => {
      try {
        if (!events || !Array.isArray(events)) return [];
        
        const dayStart = startOfDay(day);
        
        return events.filter(event => {
          try {
            if (!event || !event.date) return false;
            
            const eventDate = startOfDay(new Date(event.date));
            
            // For explicitly multi-day events, we need to check if this day falls within their range
            if (isMultiDayEvent(event)) {
              // For now, we'll be conservative and only show on the exact event date
              // TODO: Implement proper date range checking when we have end dates
              return eventDate.getTime() === dayStart.getTime();
            }
            
            // For single-day events, ONLY show on the exact date
            return eventDate.getTime() === dayStart.getTime();
          } catch (error) {
            console.warn('Error filtering event for day:', error);
            return false;
          }
        });
      } catch (error) {
        console.warn('Error getting events for day:', error);
        return [];
      }
    };

    // Group events by date and categorize them
    const groupedEventsByDay = next7Days.map(day => {
      try {
        const dayEvents = getEventsForDay(day);
        
        // Separate all-day events from timed events
        const allDayEvents = dayEvents.filter(isAllDayEvent);
        const timedEvents = dayEvents.filter(event => !isAllDayEvent(event));
        
        // Sort all-day events alphabetically by title
        allDayEvents.sort((a, b) => {
          try {
            return (a.title || '').localeCompare(b.title || '');
          } catch (error) {
            console.warn('Error sorting all-day events:', error);
            return 0;
          }
        });
        
        // Sort timed events chronologically by start time
        timedEvents.sort((a, b) => {
          try {
            return compareTimeStrings(a.time || '', b.time || '');
          } catch (error) {
            console.warn('Error sorting timed events:', error);
            return 0;
          }
        });
        
        return {
          day,
          allDayEvents,
          timedEvents,
          totalEvents: dayEvents.length
        };
      } catch (error) {
        console.warn('Error grouping events for day:', error);
        return {
          day,
          allDayEvents: [],
          timedEvents: [],
          totalEvents: 0
        };
      }
    });

    const getDateLabel = (date: Date) => {
      try {
        if (isToday(date)) return 'Today';
        if (isTomorrow(date)) return 'Tomorrow';
        if (isYesterday(date)) return 'Yesterday';
        return format(date, 'EEEE, MMMM d');
      } catch (error) {
        console.warn('Error getting date label:', error);
        return 'Unknown Date';
      }
    };

    return (
      <div className="space-y-4 sm:space-y-6">
        {groupedEventsByDay.map(({ day, allDayEvents, timedEvents, totalEvents }) => {
          try {
            const dateStr = format(day, 'yyyy-MM-dd');
            const weather = getWeatherForDate(day);
            
            return (
              <div key={dateStr} className="space-y-3 sm:space-y-4">
                {/* Responsive Date header with horizontal rule and weather */}
                <div className="relative flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <h3 className="text-base sm:text-lg font-semibold text-white">
                      {getDateLabel(day)}
                    </h3>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white/70">
                      <span>{totalEvents} events</span>
                    </div>
                  </div>
                  
                  {/* Horizontal rule line - hidden on mobile when stacked */}
                  <div className="hidden sm:flex flex-1 mx-4">
                    <hr className="border-border w-full" />
                  </div>
                  
                   {/* Enhanced Weather display with high/low temps and provider */}
                   <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white/70 self-start sm:self-center">
                     <WeatherDisplay 
                       weather={weather}
                       className="text-xs sm:text-sm"
                       forceWhite={true}
                     />
                     
                   </div>
                </div>
                
                {/* Responsive All-day events - full width on mobile, 45% on larger screens */}
                {allDayEvents.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 sm:mb-4 w-full sm:w-[45%]">
                    {allDayEvents.map(event => (
                      <div key={`${event.id}-${dateStr}`} className="flex-shrink-0 w-full sm:w-auto">
                        <EventCard 
                          event={event} 
                          viewMode="timeline" 
                          isMultiDayDisplay={isMultiDayEvent(event)}
                          onNotionEventClick={onNotionEventClick}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Timed events */}
                <div className="space-y-2 sm:space-y-3">
                  {timedEvents.map(event => (
                    <div key={event.id}>
                      <EventCard event={event} viewMode="timeline" onNotionEventClick={onNotionEventClick} />
                    </div>
                  ))}
                  
                  {totalEvents === 0 && (
                    <div className="text-center py-3 sm:py-4 text-muted-foreground">
                      <p className="text-sm sm:text-base">No events scheduled</p>
                    </div>
                  )}
                </div>
              </div>
            );
          } catch (error) {
            console.warn('Error rendering day section:', error);
            return (
              <div key={day.toString()} className="text-center py-3 sm:py-4 text-muted-foreground">
                <p className="text-sm sm:text-base">Error displaying events for this day</p>
              </div>
            );
          }
        })}
      </div>
    );
  } catch (error) {
    console.error('Critical error in TimelineView:', error);
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm sm:text-base">Unable to display timeline view</p>
      </div>
    );
  }
};

export default TimelineView;
