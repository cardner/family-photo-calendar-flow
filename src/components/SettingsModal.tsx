/**
 * SettingsModal Component
 * 
 * Main configuration interface for the Family Calendar application.
 * Provides tabbed access to different settings categories including:
 * - Calendar management (iCal feeds, local events)
 * - Photo backgrounds (Google Photos integration)
 * - Display preferences (theme, default view)
 * - Weather configuration (API keys, location)
 * - App updates (manual check and install, GitHub repository configuration)
 * - Security settings (client-side encryption)
 * 
 * Features:
 * - Responsive design for mobile and desktop
 * - Security integration with client-side encryption
 * - Real-time settings validation and persistence
 * - Version information display
 * - Offline status indication
 * - Manual update management
 * - GitHub repository configuration for release checking
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useSettings } from '@/contexts/settings/SettingsContext';
import { useSettingsModal } from '@/hooks/useSettingsModal';
import SettingsModalHeader from './settings/SettingsModalHeader';
import SettingsTabNavigation from './settings/SettingsTabNavigation';
import SecurityTab from './settings/SecurityTab';
import PhotosTab from './settings/PhotosTab';
import DisplayTab from './settings/DisplayTab';
import WeatherTab from './settings/WeatherTab';
import CalendarsTab from './settings/CalendarsTab';
import LogsTab from './settings/LogsTab';

interface SettingsModalProps {
  /** Controls modal visibility */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Main settings modal component with tabbed interface
 * Integrates all application configuration options in one place
 */
const SettingsModal = ({ open, onOpenChange }: SettingsModalProps) => {
  // Context hooks for settings management
  const { 
    theme, 
    setTheme, 
    defaultView, 
    setDefaultView
  } = useSettings();
  
  const { handleThemeChange, versionInfo } = useSettingsModal();

  /**
   * Handle theme changes and apply them immediately
   * Updates both settings context and theme context
   */
  const onThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    handleThemeChange(newTheme);
  };

  const handleRefreshApp = useCallback(() => {
    window.location.reload();
  }, []);

  // Scope to target log timestamps only
  const logsScopeRef = useRef<HTMLDivElement | null>(null);

  // hh:mm:ss AM/PM dd-mm-yyyy
  const formatTsWithSeconds = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    const h24 = d.getHours();
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    const hh = pad(h12);
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    const dd = pad(d.getDate());
    const mon = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    return `${hh}:${mm}:${ss} ${ampm} ${dd}-${mon}-${yyyy}`;
  };

  useEffect(() => {
    if (!open) return;
    const scope = logsScopeRef.current;
    if (!scope) return;

    const update = () => {
      const times = scope.querySelectorAll('time[dateTime]');
      times.forEach((el) => {
        const dt = el.getAttribute('dateTime');
        if (!dt) return;
        (el as HTMLElement).textContent = formatTsWithSeconds(dt);
      });
    };

    // Initial pass and observe for changes
    update();
    const obs = new MutationObserver(update);
    obs.observe(scope, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-[90vw] md:max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-0 fixed top-[5vh] left-[50%] translate-x-[-50%] translate-y-0 flex flex-col">
  <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0 overflow-y-auto flex-1">
          <SettingsModalHeader onClose={() => onOpenChange(false)} />

          {/* Main tabbed interface - responsive grid layout */}
          <Tabs defaultValue="calendars" className="w-full mt-4 sm:mt-6">
            <SettingsTabNavigation />

            <div className="mt-4 sm:mt-6">
              {/* Calendar management content */}
              <TabsContent value="calendars" className="space-y-4 mt-0">
                <CalendarsTab />
              </TabsContent>

              {/* Photo backgrounds content */}
              <TabsContent value="photos" className="space-y-4 mt-0">
                <PhotosTab />
              </TabsContent>

              {/* Display preferences content */}
              <TabsContent value="display" className="space-y-4 mt-0">
                <DisplayTab 
                  theme={theme}
                  onThemeChange={onThemeChange}
                  defaultView={defaultView}
                  onDefaultViewChange={setDefaultView}
                />
              </TabsContent>

              {/* Weather configuration content */}
              <TabsContent value="weather" className="space-y-4 mt-0">
                <WeatherTab />
              </TabsContent>


              {/* Security settings content */}
              <TabsContent value="security" className="space-y-4 mt-0">
                <SecurityTab />
              </TabsContent>

              {/* Logs content */}
              <TabsContent value="logs" className="focus-visible:outline-none">
                <div ref={logsScopeRef} data-logs-scope>
                  <LogsTab />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
        {/* Persistent Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 sm:px-6 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">Changes are saved automatically.</div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={handleRefreshApp}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh App
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
