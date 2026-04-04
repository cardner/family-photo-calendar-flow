import { Event } from '@/types/calendar';

export const hasAdditionalData = (event: Event): boolean => {
  return !!(event.location || event.description);
};

export const isAllDayEvent = (time: string): boolean => {
  // Handle undefined, null, or empty time values
  if (!time || time.trim() === '') {
    
    return true;
  }
  
  const timeStr = time.toLowerCase().trim();
  
  // Explicit all-day indicators
  if (timeStr.includes('all day') || timeStr.includes('all-day')) {
    
    return true;
  }
  
  // Full day time ranges
  if (timeStr === '00:00 - 23:59' || timeStr === '0:00 - 23:59') {
    
    return true;
  }
  
  // Multi-day indicators
  if (timeStr.includes('days') || timeStr.includes('day')) {
    
    return true;
  }
  
  
  return false;
};

export const hasEventPassed = (event: Event, viewMode: string): boolean => {
  if (viewMode === 'month') return false;
  
  const isAllDay = isAllDayEvent(event.time);
  if (isAllDay) return false;
  
  const now = new Date();
  const eventDate = new Date(event.date);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);
  
  if (eventDate < today) {
    return true;
  } else if (eventDate > today) {
    return false;
  }
  
  const timeString = event.time.toLowerCase();
  
  if (timeString.includes('days')) {
    return false;
  }
  
  const timeMatch = timeString.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)?\s*-\s*(\d{1,2}):?(\d{0,2})\s*(am|pm)?/);
  
  if (timeMatch) {
    let endHour = parseInt(timeMatch[4]);
    const endMinute = parseInt(timeMatch[5]) || 0;
    const endPeriod = timeMatch[6];
    
    if (endPeriod === 'pm' && endHour !== 12) {
      endHour += 12;
    } else if (endPeriod === 'am' && endHour === 12) {
      endHour = 0;
    }
    
    const endTime = new Date(event.date);
    endTime.setHours(endHour, endMinute, 0, 0);
    
    return now > endTime;
  } else {
    const singleTimeMatch = timeString.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)?/);
    
    if (singleTimeMatch) {
      let startHour = parseInt(singleTimeMatch[1]);
      const startMinute = parseInt(singleTimeMatch[2]) || 0;
      const startPeriod = singleTimeMatch[3];
      
      if (startPeriod === 'pm' && startHour !== 12) {
        startHour += 12;
      } else if (startPeriod === 'am' && startHour === 12) {
        startHour = 0;
      }
      
      const endTime = new Date(event.date);
      endTime.setHours(startHour, startMinute + 20, 0, 0);
      
      return now > endTime;
    }
  }
  
  return false;
};

export const getEventStyles = (event: Event, viewMode: string) => {
  const isAllDay = isAllDayEvent(event.time);
  const isPast = hasEventPassed(event, viewMode);
  
  const getBackgroundOpacity = () => {
    if (isPast && (viewMode === 'timeline' || viewMode === 'week')) {
      return 'bg-white/40 dark:bg-gray-800/30';
    }
    return 'bg-white/90 dark:bg-gray-800/75';
  };

  const getHoverBackgroundOpacity = () => {
    if (isPast && (viewMode === 'timeline' || viewMode === 'week')) {
      return 'hover:bg-white/50 dark:hover:bg-gray-800/40';
    }
    return 'hover:bg-white/95 dark:hover:bg-gray-800/85';
  };

  const getTextColorClasses = () => {
    if (isPast && (viewMode === 'timeline' || viewMode === 'week')) {
      return {
        title: 'font-medium text-gray-500 dark:text-gray-400',
        time: 'text-gray-400 dark:text-gray-500',
        location: 'text-gray-400 dark:text-gray-500',
        description: 'text-gray-400 dark:text-gray-500',
        category: 'text-gray-400 dark:text-gray-500 font-medium'
      };
    }
    return {
      title: 'font-medium text-gray-800 dark:text-gray-100',
      time: 'text-gray-600 dark:text-gray-300',
      location: 'text-gray-600 dark:text-gray-300',
      description: 'text-gray-600 dark:text-gray-300',
      category: 'text-gray-600 dark:text-gray-300 font-medium'
    };
  };

  const getFontSizeClasses = () => {
    if (viewMode === 'timeline') {
      return {
        title: isAllDay ? 'text-sm' : 'text-lg',
        time: isAllDay ? 'text-xs' : 'text-base',
        location: isAllDay ? 'text-xs' : 'text-base',
        description: isAllDay ? 'text-xs' : 'text-base',
        category: isAllDay ? 'text-xs' : 'text-base'
      };
    }
    return {
      title: isAllDay ? 'text-xs' : 'text-sm',
      time: 'text-xs',
      location: 'text-xs',
      description: 'text-xs',
      category: 'text-xs'
    };
  };

  const getTimelineStyles = () => {
    if (viewMode !== 'timeline') return '';
    
    if (isAllDay) {
      return 'box-border w-full min-w-0 max-w-full';
    }
    
    return 'w-[35%]';
  };

  const getPaddingClass = () => {
    if (isAllDay) {
      return 'px-2 py-1';
    }
    return 'p-3';
  };

  return {
    backgroundOpacity: getBackgroundOpacity(),
    hoverBackgroundOpacity: getHoverBackgroundOpacity(),
    textColors: getTextColorClasses(),
    fontSizes: getFontSizeClasses(),
    timelineStyles: getTimelineStyles(),
    paddingClass: getPaddingClass(),
    isAllDay,
    isPast
  };
};
