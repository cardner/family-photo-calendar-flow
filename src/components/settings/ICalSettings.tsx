import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useICalCalendars } from '@/hooks/useICalCalendars';
import { useCalendarSelection } from '@/hooks/useCalendarSelection';
import { Calendar, Plus, RotateCcw, BarChart3, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';
import EditableCalendarCard from './EditableCalendarCard';
import { ICalCalendar } from '@/types/ical';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

const CALENDAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

interface ICalSettingsProps {
  selectedCalendarIds?: string[];
  onToggleSelection?: (calendarId: string, selected: boolean) => void;
}

const ICalSettings = ({ 
  selectedCalendarIds: propSelectedCalendarIds, 
  onToggleSelection: propOnToggleSelection 
}: ICalSettingsProps = {}) => {
  const {
    calendars,
    isLoading,
    syncStatus,
    addCalendar,
    updateCalendar,
    removeCalendar,
    syncCalendar,
    syncAllCalendars
  } = useICalCalendars();
  const {
    selectedCalendarIds: hookSelectedCalendarIds,
    toggleCalendar: hookToggleCalendar,
    calendarsFromEvents,
    forceRefresh
  } = useCalendarSelection();

  const selectedCalendarIds = propSelectedCalendarIds || hookSelectedCalendarIds;
  const toggleCalendar = propOnToggleSelection || hookToggleCalendar;
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCalendar, setNewCalendar] = useState({
    name: '',
    url: '',
    color: CALENDAR_COLORS[0],
    enabled: true,
    syncFrequencyPerDay: 0
  });

  // Filter calendars to only show iCal/ICS feeds (exclude Notion calendars)
  const iCalOnlyCalendars = useMemo(() => {
    const calendarMap = new Map<string, ICalCalendar>();

    // Only add calendars from IndexedDB that have URLs (are actual iCal feeds)
    calendars.forEach(cal => {
      if (cal.url && cal.url.trim() !== '') {
  // debug removed: processing iCal calendar from IndexedDB
        calendarMap.set(cal.id, {
          ...cal,
          source: 'config',
          hasEvents: calendarsFromEvents.some(eventCal => eventCal.id === cal.id && eventCal.hasEvents),
          eventCount: calendarsFromEvents.find(eventCal => eventCal.id === cal.id)?.eventCount || cal.eventCount || 0
        });
      }
    });

    // Add calendars from events that aren't in IndexedDB (orphaned calendars) but exclude local and notion calendars
    calendarsFromEvents.forEach(eventCal => {
      if (!calendarMap.has(eventCal.id) && 
          eventCal.id !== 'local_calendar' && 
          !eventCal.id.startsWith('notion_') &&
          !eventCal.id.includes('scraped')) {
  // debug removed: processing orphaned iCal calendar from events
        calendarMap.set(eventCal.id, {
          id: eventCal.id,
          name: eventCal.summary,
          url: '',
          color: eventCal.color || '#3b82f6',
          enabled: true,
          source: 'events',
          hasEvents: eventCal.hasEvents,
          eventCount: eventCal.eventCount,
          lastSync: eventCal.lastSync
        });
      }
    });
    
    const result = Array.from(calendarMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  // debug removed: filtered iCal-only calendars list
    return result;
  }, [calendars, calendarsFromEvents]);

  const handleAddCalendar = async () => {
    if (!newCalendar.name.trim() || !newCalendar.url.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both a name and URL for the calendar.",
        variant: "destructive"
      });
      return;
    }

    // Enhanced, flexible URL validation
    const isLikelyICalUrl = (raw: string): boolean => {
      const url = raw.trim();
      try {
        const u = new URL(url);
        const full = u.href.toLowerCase();
        // Accept common patterns: .ics links, format=ical exports, Google Calendar /ical/ paths, Outlook share endpoints
        if (/\.ics($|[?#])/i.test(full)) return true;
        if (/[?&]format=ical(&|$)/i.test(full)) return true;
        if (/\/ical\//i.test(full)) return true; // e.g. Google: /calendar/ical/.../basic.ics
        if (/outlook\.office|office365|icloud|calendar\.google/i.test(u.host)) return true;
        // Fallback: if contains 'ical' anywhere
        if (full.includes('ical')) return true;
        return false;
      } catch {
        return false;
      }
    };

    const looksValid = isLikelyICalUrl(newCalendar.url);
    if (!looksValid) {
      // Don't block user completely; allow attempt so sync phase can surface real error.
      toast({
        title: "Unusual URL",
        description: "This URL doesn't look like a typical iCal feed, attempting to add anyway…",
        variant: "default"
      });
    }
    
    try {
  // debug removed: adding calendar
      const calendar = await addCalendar({
        name: newCalendar.name,
        url: newCalendar.url,
        color: newCalendar.color,
        enabled: newCalendar.enabled
      });
  // debug removed: calendar added successfully

      // Force refresh the calendar selection immediately after adding
      forceRefresh();

      // Try to sync immediately to validate the URL and get events
      try {
        await syncCalendar(calendar);
        toast({
          title: "Calendar added and synced",
          description: `${newCalendar.name} has been added and synced successfully.`
        });
      } catch (syncError) {
        const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown sync error';
        toast({
          title: "Calendar added",
          description: `${newCalendar.name} was added but sync failed: ${errorMessage}`,
          variant: "destructive"
        });
      }

      // Force refresh again after sync to ensure UI updates
      setTimeout(() => {
        forceRefresh();
      }, 100);

      setNewCalendar({
        name: '',
        url: '',
        color: CALENDAR_COLORS[0],
        enabled: true,
        syncFrequencyPerDay: 0
      });
      setShowAddDialog(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Failed to add calendar",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleSync = async (calendar: ICalCalendar) => {
  // debug removed: attempting to sync calendar
    if (!calendar.url || calendar.url.trim() === '') {
      toast({
        title: "Cannot sync",
        description: "This calendar doesn't have a valid URL for syncing.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await syncCalendar(calendar);
      toast({
        title: "Sync successful",
        description: `${calendar.name} has been synced successfully.`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Sync failed",
        description: `Failed to sync ${calendar.name}: ${errorMessage}`,
        variant: "destructive"
      });
    }
  };

  const handleSyncAll = async () => {
    try {
      await syncAllCalendars();
      toast({
        title: "Sync completed",
        description: "All enabled calendars have been synced."
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Sync failed",
        description: `Failed to sync some calendars: ${errorMessage}`,
        variant: "destructive"
      });
    }
  };

  const handleRemove = async (calendar: ICalCalendar) => {
    try {
      await removeCalendar(calendar.id);
      toast({
        title: "Calendar removed",
        description: `${calendar.name} and all its events have been removed.`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Failed to remove calendar",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleUpdateCalendar = async (id: string, updates: Partial<ICalCalendar>) => {
    try {
      await updateCalendar(id, updates);
      toast({
        title: "Calendar updated",
        description: "Calendar has been updated successfully."
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Failed to update calendar",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const enabledCalendarsCount = iCalOnlyCalendars.filter(cal => cal.enabled && cal.source === 'config').length;
  const totalEvents = calendarsFromEvents
    .filter(cal => !cal.id.startsWith('notion_') && !cal.id.includes('scraped') && cal.id !== 'local_calendar')
    .reduce((sum, cal) => sum + cal.eventCount, 0);
  const calendarsWithEventsCount = calendarsFromEvents
    .filter(cal => !cal.id.startsWith('notion_') && !cal.id.includes('scraped') && cal.id !== 'local_calendar' && cal.hasEvents)
    .length;

  return (
    <SettingsSectionCard
      heading={(
        <span className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendar Feeds
        </span>
      )}
      description="Add external calendar feeds using iCal/ICS URLs. Does not include Notion calendars."
      actions={iCalOnlyCalendars.length > 0 ? (
        <Button
          onClick={handleSyncAll}
          disabled={isLoading || enabledCalendarsCount === 0}
          variant="outline"
          size="sm"
          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
        >
          <RotateCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Sync All ({enabledCalendarsCount})
        </Button>
      ) : undefined}
      contentClassName="space-y-4"
    >
      {totalEvents > 0 && (
        <InfoBanner variant="info">
          <InfoBannerIcon>
            <BarChart3 className="h-5 w-5" />
          </InfoBannerIcon>
          <InfoBannerContent>
            <InfoBannerTitle variant="info">iCal feed summary</InfoBannerTitle>
            <div className="grid grid-cols-3 gap-4 text-sm text-blue-900 dark:text-blue-100">
              <div>
                <span className="block font-medium">{totalEvents}</span>
                <span className="text-blue-700 dark:text-blue-300">Total events</span>
              </div>
              <div>
                <span className="block font-medium">{calendarsWithEventsCount}</span>
                <span className="text-blue-700 dark:text-blue-300">Active calendars</span>
              </div>
              <div>
                <span className="block font-medium">{selectedCalendarIds.filter(id => !id.startsWith('notion_') && !id.includes('scraped')).length}</span>
                <span className="text-blue-700 dark:text-blue-300">Selected</span>
              </div>
            </div>
          </InfoBannerContent>
        </InfoBanner>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogTrigger asChild>
          <Button className="w-full bg-gray-700 hover:bg-gray-600 dark:bg-slate-900 dark:hover:bg-slate-800 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add Calendar Feed
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">Add Calendar Feed</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Enter the details for your calendar feed. Data will be stored locally in your browser.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="calendar-name" className="text-gray-700 dark:text-gray-300">Calendar Name</Label>
              <Input
                id="calendar-name"
                placeholder="My Calendar"
                value={newCalendar.name}
                onChange={(e) => setNewCalendar(prev => ({ ...prev, name: e.target.value }))}
                className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <Label htmlFor="calendar-url" className="text-gray-700 dark:text-gray-300">iCal URL</Label>
              <Input
                id="calendar-url"
                placeholder="https://calendar.example.com/feed.ics"
                value={newCalendar.url}
                onChange={(e) => setNewCalendar(prev => ({ ...prev, url: e.target.value }))}
                className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Calendar Color</Label>
              <div className="flex gap-2 mt-2">
                {CALENDAR_COLORS.map(color => (
                  <button
                    key={color}
                    className={`w-6 h-6 rounded-full border-2 ${
                      newCalendar.color === color ? 'border-gray-900 dark:border-gray-100' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCalendar(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-gray-700 dark:text-gray-300">Auto Sync (per day)</Label>
                <select
                  value={newCalendar.syncFrequencyPerDay}
                  onChange={(e) => setNewCalendar(prev => ({ ...prev, syncFrequencyPerDay: Number(e.target.value) }))}
                  className="mt-1 w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
                >
                  <option value={0}>Manual only</option>
                  <option value={1}>1 / day</option>
                  <option value={2}>2 / day (12h)</option>
                  <option value={4}>4 / day (6h)</option>
                  <option value={6}>6 / day (4h)</option>
                  <option value={8}>8 / day (3h)</option>
                  <option value={12}>12 / day (2h)</option>
                  <option value={24}>24 / day (hourly)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCalendar}
                disabled={isLoading}
                className="bg-gray-600 hover:bg-gray-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
              >
                Add Calendar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {iCalOnlyCalendars.length > 0 ? (
        <div className="space-y-3">
          {iCalOnlyCalendars.map(calendar => (
            <EditableCalendarCard
              key={calendar.id}
              calendar={calendar}
              isSelected={selectedCalendarIds.includes(calendar.id)}
              syncStatus={syncStatus[calendar.id] || ''}
              onUpdate={handleUpdateCalendar}
              onSync={handleSync}
              onRemove={handleRemove}
              onToggleSelection={(calendarId: string, selected: boolean) => {
                toggleCalendar(calendarId, selected);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No iCal calendar feeds added yet.</p>
          <p className="text-sm">Add your first calendar feed to get started.</p>
        </div>
      )}

      <InfoBanner variant="info">
        <InfoBannerIcon>
          <AlertCircle className="h-5 w-5" />
        </InfoBannerIcon>
        <InfoBannerContent>
          <InfoBannerTitle variant="info">Tips for calendar feeds</InfoBannerTitle>
          <InfoBannerDescription variant="info" className="space-y-1 text-sm">
            <p>• Calendar data is stored locally in your browser using IndexedDB.</p>
            <p>• Click the edit icon to modify calendar name, URL, or color.</p>
            <p>• Use the sync buttons to manually refresh calendar data.</p>
            <p>• Look for "Export" or "Share" options in your calendar application.</p>
            <p>• Typical feed URLs end with .ics, include /ical/ in the path, or use format=ical.</p>
          </InfoBannerDescription>
        </InfoBannerContent>
      </InfoBanner>
    </SettingsSectionCard>
  );
};

export default ICalSettings;
