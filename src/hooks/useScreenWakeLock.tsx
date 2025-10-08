/**
 * Screen Wake Lock Hook
 *
 * Manages the Screen Wake Lock API to prevent the device screen from turning off.
 * Automatically handles visibility changes and API availability.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export const useScreenWakeLock = (enabled: boolean) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<Awaited<ReturnType<NonNullable<Navigator['wakeLock']>['request']>> | null>(null);

  // Check if the API is supported
  useEffect(() => {
    setIsSupported('wakeLock' in navigator && typeof navigator.wakeLock?.request === 'function');
  }, []);

  // Request wake lock when enabled
  const requestWakeLock = useCallback(async () => {
    if (!isSupported || !enabled) return;

    try {
      wakeLockRef.current = await navigator.wakeLock!.request('screen');
      setIsActive(true);

      // Listen for release events
      wakeLockRef.current.addEventListener('release', () => {
        setIsActive(false);
        wakeLockRef.current = null;
      });

      console.warn('[WakeLock] Screen wake lock acquired');
    } catch (error) {
      console.warn('[WakeLock] Failed to acquire wake lock:', error);
      setIsActive(false);
    }
  }, [isSupported, enabled]);

  // Release wake lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
        console.warn('[WakeLock] Screen wake lock released');
      } catch (error) {
        console.warn('[WakeLock] Failed to release wake lock:', error);
      }
    }
  }, []);

  // Handle visibility change to re-acquire wake lock when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && isSupported) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, isSupported, requestWakeLock]);

  // Handle enabled state changes
  useEffect(() => {
    if (enabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  return {
    isSupported,
    isActive,
    requestWakeLock,
    releaseWakeLock,
  };
};