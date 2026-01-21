
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface BackgroundSyncResult {
  timestamp: string;
  syncedCount: number;
  errorCount: number;
  totalCalendars: number;
}

export const useBackgroundSync = () => {
  const [isBackgroundSyncSupported, setIsBackgroundSyncSupported] = useState(false);
  const [isPeriodicSyncSupported, setIsPeriodicSyncSupported] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<BackgroundSyncResult | null>(null);
  const [syncQueue, setSyncQueue] = useState<unknown[]>([]);
  const { toast } = useToast();

  // Process sync queue from service worker
  const processSyncQueue = useCallback(() => {
    try {
      const queueData = localStorage.getItem('calendar_sync_queue');
      if (queueData) {
        const queue = JSON.parse(queueData);
        setSyncQueue(queue);
        
        // Clear the queue after processing
        localStorage.removeItem('calendar_sync_queue');
        
        // Trigger a refresh of calendar data in the main application
        window.dispatchEvent(new CustomEvent('background-sync-data-available', { 
          detail: { syncQueue: queue } 
        }));
      }
    } catch (error) {
      console.error('Error processing sync queue:', error);
    }
  }, []);

  const isIOSStandalone = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    return isIOS && !!isStandalone;
  }, []);

  // Check for background sync support
  useEffect(() => {
    if (isIOSStandalone()) {
      setIsBackgroundSyncSupported(false);
      setIsPeriodicSyncSupported(false);
      return;
    }

    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      setIsBackgroundSyncSupported(true);
    }
    
    if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
      setIsPeriodicSyncSupported(true);
    }
  }, [isIOSStandalone]);

  // Listen for background sync messages
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'BACKGROUND_SYNC_COMPLETE') {
          const result = event.data.result as BackgroundSyncResult;
          setLastSyncResult(result);
          
          // Show success toast
          if (result.syncedCount > 0) {
            toast({
              title: "Background sync completed",
              description: `Successfully synced ${result.syncedCount} calendar(s)`,
            });
          }
          
          if (result.errorCount > 0) {
            toast({
              title: "Sync issues detected",
              description: `${result.errorCount} calendar(s) failed to sync`,
              variant: "destructive"
            });
          }

          // Process any queued sync data
          processSyncQueue();
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [toast, processSyncQueue]);

  // Register for background sync
  const registerBackgroundSync = useCallback(async (): Promise<boolean> => {
    if (!isBackgroundSyncSupported || isIOSStandalone()) {
      console.warn('Background sync not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.success);
        };
        
        registration.active?.postMessage(
          { type: 'REGISTER_BACKGROUND_SYNC' },
          [messageChannel.port2]
        );
      });
    } catch (error) {
      console.error('Failed to register background sync:', error);
      return false;
    }
  }, [isBackgroundSyncSupported, isIOSStandalone]);

  // Register for periodic background sync
  const registerPeriodicSync = useCallback(async (): Promise<boolean> => {
    if (!isPeriodicSyncSupported || isIOSStandalone()) {
      console.warn('Periodic sync not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.success);
        };
        
        registration.active?.postMessage(
          { type: 'REGISTER_PERIODIC_SYNC' },
          [messageChannel.port2]
        );
      });
    } catch (error) {
      console.error('Failed to register periodic sync:', error);
      return false;
    }
  }, [isPeriodicSyncSupported, isIOSStandalone]);

  // Manually trigger background sync - Fixed TypeScript error
  const triggerBackgroundSync = useCallback(async (): Promise<boolean> => {
    if (!isBackgroundSyncSupported || isIOSStandalone()) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if sync property exists before using it
      if ('sync' in registration) {
        await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register('calendar-sync');
        
        toast({
          title: "Background sync scheduled",
          description: "Calendar sync will run in the background",
        });
        
        return true;
      } else {
        console.warn('Background sync not available on this registration');
        return false;
      }
    } catch (error) {
      console.error('Failed to trigger background sync:', error);
      return false;
    }
  }, [isBackgroundSyncSupported, isIOSStandalone, toast]);

  return {
    isBackgroundSyncSupported,
    isPeriodicSyncSupported,
    lastSyncResult,
    syncQueue,
    registerBackgroundSync,
    registerPeriodicSync,
    triggerBackgroundSync,
    processSyncQueue
  };
};
