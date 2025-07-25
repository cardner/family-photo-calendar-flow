import React, { useState, useEffect } from 'react';
import { Event } from '@/types/calendar';
import EventCard from './EventCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sun, Cloud, CloudRain, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { getWeatherIcon } from '@/utils/weatherIcons';

interface DayViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  events: Event[];
  getWeatherForDate: (date: Date) => { temp: number; condition: string };
  onNavigateDay?: (direction: 'prev' | 'next') => void;
  onNotionEventClick?: (event: Event) => void;
}

const DayViewModal = ({ 
  open, 
  onOpenChange, 
  date, 
  events, 
  getWeatherForDate,
  onNavigateDay,
  onNotionEventClick
}: DayViewModalProps) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'prev' | 'next' | null>(null);
  
  const weather = getWeatherForDate(date);
  const isToday = date.toDateString() === new Date().toDateString();

  // Debug logging
  

  const handleNavigation = (direction: 'prev' | 'next') => {
    if (!onNavigateDay || isTransitioning) return;
    
    setIsTransitioning(true);
    setTransitionDirection(direction);
    
    // Trigger the navigation after a brief delay to show the exit animation
    setTimeout(() => {
      onNavigateDay(direction);
      
      // Reset transition state after the new content loads
      setTimeout(() => {
        setIsTransitioning(false);
        setTransitionDirection(null);
      }, 300);
    }, 150);
  };

  // Reset transition state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setIsTransitioning(false);
      setTransitionDirection(null);
    }
  }, [open]);

  const sortEventsByTimeAndType = (events: Event[]) => {
    return events.sort((a, b) => {
      const aIsAllDay = a.time.toLowerCase().includes('all day');
      const bIsAllDay = b.time.toLowerCase().includes('all day');
      const aIsMultiDay = a.time.includes('days');
      const bIsMultiDay = b.time.includes('days');
      
      // Multi-day events first
      if (aIsMultiDay && !bIsMultiDay) return -1;
      if (!aIsMultiDay && bIsMultiDay) return 1;
      
      // All-day events next
      if (aIsAllDay && !bIsAllDay) return -1;
      if (!aIsAllDay && bIsAllDay) return 1;
      
      // For timed events, sort by time
      if (!aIsAllDay && !bIsAllDay) {
        const getTimeValue = (timeStr: string) => {
          const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (match) {
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const period = match[3]?.toUpperCase();
            
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            
            return hours * 60 + minutes;
          }
          return 0;
        };
        
        return getTimeValue(a.time) - getTimeValue(b.time);
      }
      
      return 0;
    });
  };

  const sortedEvents = sortEventsByTimeAndType(events);
  const allDayEvents = sortedEvents.filter(event => event.time.toLowerCase().includes('all day'));
  const timedEvents = sortedEvents.filter(event => !event.time.toLowerCase().includes('all day'));


  // Get transition classes based on current state
  const getContentTransitionClasses = () => {
    if (!isTransitioning) {
      return 'transform transition-all duration-300 ease-in-out translate-x-0 scale-100 opacity-100';
    }
    
    if (transitionDirection === 'next') {
      return 'transform transition-all duration-300 ease-in-out -translate-x-full scale-75 opacity-0';
    } else {
      return 'transform transition-all duration-300 ease-in-out translate-x-full scale-75 opacity-0';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[85vw] max-w-3xl h-[85vh] max-h-none bg-white/95 backdrop-blur-sm border-white/20 p-0">
        <DialogHeader className="px-4 pt-3 pb-6 border-b border-gray-200/50 h-[120px]">
          <DialogTitle className="flex items-center justify-between text-lg pr-8">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Calendar className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <span className={`truncate ${isToday ? 'text-yellow-600' : 'text-gray-900'}`}>
                {date.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
                {isToday && <span className="ml-2 text-sm text-yellow-600">(Today)</span>}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-gray-600">
                {getWeatherIcon(weather.condition, { size: "h-5 w-5" })}
                <span className="text-sm font-medium">{weather.temp}°</span>
              </div>
              <div className="text-xs text-gray-500">
                {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
              </div>
            </div>
          </DialogTitle>
          
          {/* Navigation buttons - Always show for debugging */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigation('prev')}
              disabled={isTransitioning || !onNavigateDay}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100/50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous Day
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigation('next')}
              disabled={isTransitioning || !onNavigateDay}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100/50"
            >
              Next Day
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Debug info */}
          {!onNavigateDay && (
            <div className="text-xs text-red-500 text-center mt-2">
              Navigation disabled - onNavigateDay prop not provided
            </div>
          )}
        </DialogHeader>
        
        <div className={`flex-1 overflow-y-auto px-6 pb-6 ${getContentTransitionClasses()}`}>
          {sortedEvents.length > 0 ? (
            <div className="space-y-6">
              {/* All-day events section */}
              {allDayEvents.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600 border-b border-gray-200 pb-2">
                    <Clock className="h-4 w-4" />
                    All Day Events
                  </div>
                  <div className="space-y-3">
                    {allDayEvents.map((event) => (
                      <EventCard 
                        key={event.id} 
                        event={event}
                        className="bg-white/80 border border-gray-200 shadow-sm w-full"
                        viewMode="timeline"
                        onNotionEventClick={onNotionEventClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Timed events section */}
              {timedEvents.length > 0 && (
                <div className="space-y-3">
                  {allDayEvents.length > 0 && (
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600 border-b border-gray-200 pb-2">
                      <Clock className="h-4 w-4" />
                      Scheduled Events
                    </div>
                  )}
                  <div className="space-y-3">
                    {timedEvents.map((event) => (
                      <EventCard 
                        key={event.id} 
                        event={event}
                        className="bg-white/80 border border-gray-200 shadow-sm w-full"
                        viewMode="timeline"
                        onNotionEventClick={onNotionEventClick}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Calendar className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No events scheduled</p>
              <p className="text-sm">This day is free for new activities</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DayViewModal;
