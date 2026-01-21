
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Calendar } from 'lucide-react';
import { useNotionScrapedCalendars } from '@/hooks/useNotionScrapedCalendars';
import { useCalendarSelection } from '@/hooks/useCalendarSelection';
import { useSettings } from '@/contexts/settings/SettingsContext';
import { NotionUrlForm } from './NotionUrlForm';
import ScrapedCalendarCard from './ScrapedCalendarCard';
import { toast } from 'sonner';
import { InfoBanner, InfoBannerContent, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

interface NotionScrapedSettingsProps {
  selectedCalendarIds: string[];
  onToggleSelection: (calendarId: string, selected: boolean) => void;
}

const NotionScrapedSettings = ({ selectedCalendarIds, onToggleSelection }: NotionScrapedSettingsProps) => {
  const [showAddForm, setShowAddForm] = React.useState(false);
  const { 
    calendars, 
    isLoading, 
    addCalendar, 
    removeCalendar, 
    updateCalendar, 
    syncCalendar,
    syncAllCalendars,
    syncStatus,
    validateNotionUrl
  } = useNotionScrapedCalendars();
  const { forceRefresh } = useCalendarSelection();

  const handleAddCalendar = async (data: { name: string; url: string; color: string; token?: string; databaseId: string; connectionMode: 'api' | 'public' }) => {
    try {
      const setupTimestamp = new Date().toISOString();
      await addCalendar({ 
        name: data.name, 
        url: data.url, 
        color: data.color,
        enabled: true,
  syncFrequencyPerDay: 0,
        metadata: {
          token: data.token,
          databaseId: data.databaseId,
          url: data.url,
          title: data.name,
          lastScraped: new Date(),
          eventCount: 0
        },
        connectionMode: data.connectionMode,
        lastSetupAttempt: setupTimestamp,
        lastSetupResult: 'success'
      });
      
      // Force refresh calendar views immediately after adding
      forceRefresh();
      
      setShowAddForm(false);
      toast.success('Notion database added successfully');
      
      // Force refresh again after a short delay to ensure UI updates
      setTimeout(() => {
        forceRefresh();
      }, 100);
    } catch (error) {
      console.error('Error adding Notion calendar:', error);
      try {
        localStorage.setItem('notion_setup_last_attempt', JSON.stringify({
          url: data.url,
          result: 'error',
          error: error instanceof Error ? error.message : 'Failed to add Notion database',
          timestamp: new Date().toISOString()
        }));
      } catch (storageError) {
        console.warn('Failed to record Notion setup attempt', storageError);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to add Notion database');
    }
  };

  const handleToggleCalendar = async (id: string, enabled: boolean) => {
    try {
      await updateCalendar(id, { enabled });
      toast.success(enabled ? 'Calendar enabled' : 'Calendar disabled');
    } catch (error) {
      console.error('Error updating calendar:', error);
      toast.error('Failed to update calendar');
    }
  };

  const handleDeleteCalendar = async (id: string) => {
    try {
      await removeCalendar(id);
      toast.success('Notion database removed');
    } catch (error) {
      console.error('Error removing calendar:', error);
      toast.error('Failed to remove calendar');
    }
  };

  const handleSyncCalendar = async (id: string) => {
    try {
      const calendar = calendars.find(cal => cal.id === id);
      if (calendar) {
        await syncCalendar(calendar);
        toast.success('Calendar synced successfully');
      }
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast.error('Failed to sync calendar');
    }
  };

  const handleSyncAll = async () => {
    try {
      await syncAllCalendars();
      toast.success('All calendars synced successfully');
    } catch (error) {
      console.error('Error syncing all calendars:', error);
      toast.error('Failed to sync calendars');
    }
  };

  const handleUpdateFrequency = async (id: string, freq: number) => {
    try {
      await updateCalendar(id, { syncFrequencyPerDay: freq });
      toast.success(freq ? `Auto sync set to ${freq}/day` : 'Auto sync disabled');
    } catch (e) {
      toast.error('Failed to update frequency');
    }
  };

  const handleToggleSelection = (calendarId: string, selected: boolean) => {
    // debug removed: notion scraped settings toggle selection
    onToggleSelection(calendarId, selected);
  };

  const enabledCalendars = calendars.filter(cal => cal.enabled);
  const totalEvents = calendars.reduce((sum, cal) => sum + (cal.eventCount || 0), 0);
  const selectedCount = calendars.filter(cal => selectedCalendarIds.includes(cal.id)).length;

  // debug removed: notion scraped settings render state

  return (
    <div className="space-y-4">
      {/* Header with Add Button and Sync All */}
      <div className="flex items-end justify-end">
        <div className="flex gap-2">
          {enabledCalendars.length > 0 && (
            <Button
              onClick={handleSyncAll}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Sync All
            </Button>
          )}
          <Button 
            onClick={() => setShowAddForm(true)}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Database
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      {calendars.length > 0 && (
        <InfoBanner variant="info">
          <InfoBannerIcon>
            <Calendar className="h-5 w-5" />
          </InfoBannerIcon>
          <InfoBannerContent>
            <InfoBannerTitle variant="info">Database summary</InfoBannerTitle>
            <div className="grid grid-cols-2 gap-4 text-sm text-blue-900 dark:text-blue-100 md:grid-cols-4">
              <div>
                <span className="text-blue-700 dark:text-blue-200">Databases:</span>
                <span className="ml-2 font-medium">{calendars.length}</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-200">Active:</span>
                <span className="ml-2 font-medium">{enabledCalendars.length}</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-200">Visible:</span>
                <span className="ml-2 font-medium">{selectedCount}</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-200">Total Events:</span>
                <span className="ml-2 font-medium">{totalEvents}</span>
              </div>
            </div>
          </InfoBannerContent>
        </InfoBanner>
      )}

      {/* Add Form */}
      {showAddForm && (
        <SettingsSectionCard
          heading="Add Notion Database"
          contentClassName="space-y-4"
        >
          <NotionUrlForm
            onSubmit={handleAddCalendar}
            onCancel={() => setShowAddForm(false)}
            validateUrl={validateNotionUrl}
            showDebugButton={false}
          />
        </SettingsSectionCard>
      )}

      {/* Calendar Cards */}
      <div className="space-y-4">
        {calendars.map((calendar) => (
          <ScrapedCalendarCard
            key={calendar.id}
            calendar={{
              id: calendar.id,
              name: calendar.name,
              url: calendar.url,
              enabled: calendar.enabled,
              eventCount: calendar.eventCount || 0,
              lastSync: calendar.lastSync,
              type: calendar.type,
              syncFrequencyPerDay: calendar.syncFrequencyPerDay,
              connectionMode: calendar.connectionMode
            }}
            onToggle={handleToggleCalendar}
            onDelete={handleDeleteCalendar}
            onSync={handleSyncCalendar}
            isSyncing={syncStatus[calendar.id] === 'syncing'}
            isSelected={selectedCalendarIds.includes(calendar.id)}
            onToggleSelection={handleToggleSelection}
            onUpdateFrequency={handleUpdateFrequency}
          />
        ))}
      </div>

      {/* Empty State */}
      {calendars.length === 0 && !showAddForm && (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="mb-2">No Notion databases configured</p>
          <p className="text-sm mb-4">
            Add a Notion database to start syncing events automatically
          </p>
          <Button onClick={() => setShowAddForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Your First Database
          </Button>
        </div>
      )}
    </div>
  );
};

export default NotionScrapedSettings;
