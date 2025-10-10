
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { useICalCalendars } from '@/hooks/useICalCalendars';
import { useNotionScrapedCalendars } from '@/hooks/useNotionScrapedCalendars';
import { Wifi, WifiOff, RotateCcw, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';

const BackgroundSyncSettings = () => {
  const {
    isBackgroundSyncSupported,
    isPeriodicSyncSupported,
    lastSyncResult,
    triggerBackgroundSync
  } = useBackgroundSync();
  
  const { calendars, syncAllCalendars: syncAllICalCalendars } = useICalCalendars();
  const { calendars: notionCalendars, syncAllCalendars: syncAllNotionCalendars } = useNotionScrapedCalendars();

  const enabledCalendarsCount = calendars.filter(cal => cal.enabled).length + 
                               notionCalendars.filter(cal => cal.enabled).length;

  const handleManualBackgroundSync = async () => {
    await triggerBackgroundSync();
  };

  const handleTestSync = async () => {
    
    
    try {
      // Test iCal calendars
      if (calendars.filter(cal => cal.enabled).length > 0) {
        
        await syncAllICalCalendars();
      }
      
      // Test Notion calendars  
      if (notionCalendars.filter(cal => cal.enabled).length > 0) {
        
        await syncAllNotionCalendars();
      }
      
      
    } catch (error) {
      console.error('❌ Manual sync test failed:', error);
    }
  };

  return (
    <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Wifi className="h-5 w-5" />
              Background Sync
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Automatic calendar synchronization in the background using service workers
            </CardDescription>
          </div>
          {isBackgroundSyncSupported && enabledCalendarsCount > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={handleTestSync}
                variant="outline"
                size="sm"
                className="gap-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                <CheckCircle className="h-4 w-4" />
                Test Sync
              </Button>
              <Button 
                onClick={handleManualBackgroundSync}
                variant="outline" 
                size="sm"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Trigger Sync
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Support Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoBanner variant={isBackgroundSyncSupported ? 'success' : 'destructive'}>
            <InfoBannerIcon asChild={false} className="mt-0">
              {isBackgroundSyncSupported ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <WifiOff className="h-5 w-5" />
              )}
            </InfoBannerIcon>
            <InfoBannerContent className="flex-1">
              <InfoBannerTitle variant={isBackgroundSyncSupported ? 'success' : 'destructive'}>
                Background Sync
              </InfoBannerTitle>
              <Badge
                variant={isBackgroundSyncSupported ? 'default' : 'destructive'}
                className="text-xs"
              >
                {isBackgroundSyncSupported ? 'Supported' : 'Not Supported'}
              </Badge>
            </InfoBannerContent>
          </InfoBanner>

          <InfoBanner variant={isPeriodicSyncSupported ? 'success' : 'warning'}>
            <InfoBannerIcon asChild={false} className="mt-0">
              {isPeriodicSyncSupported ? (
                <Clock className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </InfoBannerIcon>
            <InfoBannerContent className="flex-1">
              <InfoBannerTitle variant={isPeriodicSyncSupported ? 'success' : 'warning'}>
                Periodic Sync
              </InfoBannerTitle>
              <Badge
                variant={isPeriodicSyncSupported ? 'default' : 'secondary'}
                className="text-xs"
              >
                {isPeriodicSyncSupported ? 'Supported' : 'Limited Support'}
              </Badge>
            </InfoBannerContent>
          </InfoBanner>
        </div>

        {/* Last Sync Result */}
        {lastSyncResult && (
          <InfoBanner variant="info">
            <InfoBannerIcon>
              <CheckCircle className="h-5 w-5" />
            </InfoBannerIcon>
            <InfoBannerContent>
              <InfoBannerTitle variant="info">Last background sync</InfoBannerTitle>
              <div className="grid grid-cols-2 gap-3 text-sm text-blue-900 dark:text-blue-100 md:grid-cols-4">
                <div>
                  <div className="font-medium">{format(new Date(lastSyncResult.timestamp), 'MMM d, HH:mm')}</div>
                  <div className="text-blue-700 dark:text-blue-300">Time</div>
                </div>
                <div>
                  <div className="font-medium">{lastSyncResult.syncedCount}</div>
                  <div className="text-blue-700 dark:text-blue-300">Synced</div>
                </div>
                <div>
                  <div className="font-medium">{lastSyncResult.errorCount}</div>
                  <div className="text-blue-700 dark:text-blue-300">Errors</div>
                </div>
                <div>
                  <div className="font-medium">{lastSyncResult.totalCalendars}</div>
                  <div className="text-blue-700 dark:text-blue-300">Total</div>
                </div>
              </div>
            </InfoBannerContent>
          </InfoBanner>
        )}

        {/* Information */}
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
            <div>
              <strong>Background Sync:</strong> Automatically syncs calendars when the app goes online or when triggered by the system.
            </div>
          </div>
          
          {isPeriodicSyncSupported && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
              <div>
                <strong>Periodic Sync:</strong> Automatically syncs calendars every hour, even when the app is closed.
              </div>
            </div>
          )}
          
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0" />
            <div>
              <strong>Manual Trigger:</strong> Use the "Trigger Sync" button to manually schedule a background sync.
            </div>
          </div>
          
          {!isBackgroundSyncSupported && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0" />
              <div>
                <strong>Browser Limitation:</strong> Your browser doesn't support background sync. Calendars will only sync when the app is open.
              </div>
            </div>
          )}
        </div>

        {/* Calendar Count Info */}
        {enabledCalendarsCount > 0 && (
          <InfoBanner>
            <InfoBannerIcon>
              <Wifi className="h-5 w-5" />
            </InfoBannerIcon>
            <InfoBannerContent>
              <InfoBannerDescription>
                Background sync monitors <strong>{enabledCalendarsCount}</strong> calendar{enabledCalendarsCount !== 1 ? 's' : ''} ({calendars.filter(cal => cal.enabled).length} iCal + {notionCalendars.filter(cal => cal.enabled).length} Notion).
              </InfoBannerDescription>
            </InfoBannerContent>
          </InfoBanner>
        )}
      </CardContent>
    </Card>
  );
};

export default BackgroundSyncSettings;
