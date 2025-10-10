
import React from 'react';
import { Calendar as CalendarIcon, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useCalendarSelection } from '@/hooks/useCalendarSelection';
import { useICalCalendars } from '@/hooks/useICalCalendars';
import { useToast } from '@/hooks/use-toast';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

const CalendarList = () => {
  const { 
    calendarsFromEvents,
    selectedCalendarIds, 
    toggleCalendar,
    selectAllCalendars,
    clearAllCalendars,
    cleanupDeletedCalendar
  } = useCalendarSelection();
  
  const { calendars: iCalCalendars, syncCalendar, syncStatus, removeCalendar } = useICalCalendars();
  const { toast } = useToast();

  const handleCalendarToggle = (calendarId: string, checked: boolean) => {
    toggleCalendar(calendarId, checked);
  };

  const handleSelectAll = () => {
    selectAllCalendars();
  };

  const handleSelectWithEvents = () => {
    const calendarsWithEventsIds = calendarsFromEvents
      .filter(cal => cal.hasEvents)
      .map(cal => cal.id);
    
    // Update selected calendars directly
    calendarsWithEventsIds.forEach(calendarId => {
      if (!selectedCalendarIds.includes(calendarId)) {
        toggleCalendar(calendarId, true);
      }
    });
    
    // Remove any selected calendars that don't have events
    selectedCalendarIds.forEach(calendarId => {
      if (!calendarsWithEventsIds.includes(calendarId)) {
        toggleCalendar(calendarId, false);
      }
    });
  };

  const handleSyncCalendar = async (calendarId: string) => {
    const iCalCalendar = iCalCalendars.find(cal => cal.id === calendarId);
    if (!iCalCalendar) {
      toast({
        title: "Cannot sync",
        description: "This calendar cannot be synced manually.",
        variant: "destructive"
      });
      return;
    }

    try {
      await syncCalendar(iCalCalendar);
      toast({
        title: "Sync successful",
        description: `${iCalCalendar.name} has been synced successfully.`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Sync failed",
        description: `Failed to sync ${iCalCalendar.name}: ${errorMessage}`,
        variant: "destructive"
      });
    }
  };

  const handleDeleteCalendar = (calendarId: string) => {
    const calendar = calendarsFromEvents.find(cal => cal.id === calendarId);
    if (!calendar) return;

    // Clean up from calendar selection first
    cleanupDeletedCalendar(calendarId);

    // Remove from iCal calendars if it exists there
    const iCalCalendar = iCalCalendars.find(cal => cal.id === calendarId);
    if (iCalCalendar) {
      removeCalendar(calendarId);
    }

    toast({
      title: "Calendar deleted",
      description: `${calendar.summary} has been removed from your calendar feeds and view.`
    });
  };

  const calendarsWithEventsCount = calendarsFromEvents.filter(cal => cal.hasEvents).length;

  // Filter out local_calendar from display
  const displayCalendars = calendarsFromEvents.filter(cal => cal.id !== 'local_calendar');

  if (displayCalendars.length === 0) {
    return null;
  }

  return (
    <SettingsSectionCard
      heading={(
        <span className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Available Calendars
        </span>
      )}
      description="Select which calendars to display in your calendar view. Changes will automatically update the calendar dropdown and view."
      contentClassName="space-y-4"
    >
          {/* Quick Actions */}
          <div className="flex gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Select All ({displayCalendars.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectWithEvents}
              className="text-xs border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              disabled={calendarsWithEventsCount === 0}
            >
              With Events ({calendarsWithEventsCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllCalendars}
              className="text-xs border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Clear All
            </Button>
            <div className="ml-auto text-xs text-gray-500 dark:text-gray-400 self-center">
              {selectedCalendarIds.length} of {displayCalendars.length} selected
            </div>
          </div>

          {/* Calendar List */}
          <div className="space-y-3">
            {displayCalendars.map((calendar) => {
              const isSelected = selectedCalendarIds.includes(calendar.id);
              const iCalCalendar = iCalCalendars.find(cal => cal.id === calendar.id);
              const canSync = iCalCalendar && iCalCalendar.enabled;
              const issyncing = syncStatus[calendar.id] === 'syncing';
              
              return (
                <div key={calendar.id} className={`flex items-center space-x-3 p-4 rounded-lg border ${
                  calendar.hasEvents 
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                }`}>
                  <Checkbox
                    id={`calendar-${calendar.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => handleCalendarToggle(calendar.id, checked === true)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <label
                        htmlFor={`calendar-${calendar.id}`}
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
                      >
                        {calendar.summary}
                      </label>
                      {calendar.primary && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
                          Primary
                        </span>
                      )}
                      {calendar.hasEvents && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
                          {calendar.eventCount} event{calendar.eventCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {issyncing && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200">
                          Syncing...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Calendar ID: {calendar.id}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Sync Button for iCal calendars */}
                    {canSync && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncCalendar(calendar.id)}
                        disabled={issyncing}
                        title="Sync this calendar"
                      >
                        <RefreshCw className={`h-4 w-4 ${issyncing ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                    
                    {/* Delete Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteCalendar(calendar.id)}
                      title="Delete this calendar"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Note: Calendar selections automatically sync with the calendar view and dropdown filter.
              All data is stored locally in your browser. External calendars can be synced and deleted individually.
            </p>
          </div>
    </SettingsSectionCard>
  );
};

export default CalendarList;
