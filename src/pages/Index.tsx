import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Calendar from '@/components/Calendar';
import WeatherWidget from '@/components/WeatherWidget';
import NotionEventModal from '@/components/NotionEventModal';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/settings/SettingsContext';
import { getImagesFromAlbum, getDefaultBackgroundImages } from '@/utils/googlePhotosUtils';
import { PerformanceMonitor, IntervalManager, displayOptimizations } from '@/utils/performanceUtils';
import { Event } from '@/types/calendar';
import { NotionScrapedEvent } from '@/services/NotionPageScraper';
import { useNotionScrapedCalendars } from '@/hooks/useNotionScrapedCalendars';
import { useSettingsModalController } from '@/contexts/settings/SettingsModalControllerContext';
const Index = () => {
  const [currentBg, setCurrentBg] = useState(0);
  const [backgroundImages, setBackgroundImages] = useState<string[]>(getDefaultBackgroundImages());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedNotionEvent, setSelectedNotionEvent] = useState<NotionScrapedEvent | null>(null);
  const [isNotionModalOpen, setIsNotionModalOpen] = useState(false);
  const {
    backgroundDuration,
    publicAlbumUrl
  } = useSettings();
  const {
    events: notionEvents
  } = useNotionScrapedCalendars();
  const { openModal: openSettingsModal } = useSettingsModalController();
  const handleNotionEventClick = (event: Event) => {
    // Find the corresponding NotionScrapedEvent
    const notionEvent = notionEvents.find(ne => ne.id === event.id);
    if (notionEvent) {
      setSelectedNotionEvent(notionEvent);
      setIsNotionModalOpen(true);
    }
  };

  // debug removed: publicAlbumUrl change logging
  useEffect(() => {
    // intentionally left blank (previously logged publicAlbumUrl changes)
  }, [publicAlbumUrl]);

  // Optimized clock update - only update minutes, not seconds
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(prev => {
        // Only update if minute has changed to reduce renders
        if (prev.getMinutes() !== now.getMinutes() || prev.getHours() !== now.getHours()) {
          return now;
        }
        return prev;
      });
    };

    // Update immediately, then every minute at the start of the minute
    updateClock();
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    const timeoutId = setTimeout(() => {
      updateClock();
      IntervalManager.setInterval('clock-update', updateClock, 60000); // Every minute
    }, msUntilNextMinute);
    return () => {
      clearTimeout(timeoutId);
      IntervalManager.clearInterval('clock-update');
    };
  }, []);

  // 24/7 display optimizations
  useEffect(() => {
    // Start performance monitoring
    PerformanceMonitor.startMonitoring();

    // Enable burn-in prevention
    const burnInInterval = displayOptimizations.enableBurnInPrevention();

    // Enable OLED optimization
    displayOptimizations.enableOLEDOptimization();

    // Adjust for time of day
    const timeAdjustmentInterval = setInterval(() => {
      displayOptimizations.adjustForTimeOfDay();
    }, 60 * 60 * 1000); // Check every hour

    // Initial time adjustment
    displayOptimizations.adjustForTimeOfDay();
    return () => {
      PerformanceMonitor.stopMonitoring();
      clearInterval(burnInInterval);
      clearInterval(timeAdjustmentInterval);
      IntervalManager.clearAllIntervals();
    };
  }, []);

  // Background image loading with ALL cached photos
  const loadBackgroundImages = useCallback(async () => {
    // debug removed: loadBackgroundImages invocation logging
    if (publicAlbumUrl && publicAlbumUrl.trim() !== '') {
      try {
        // First try to get ALL cached photos
        const {
          photosCache
        } = await import('@/utils/photosCache');
        const cachedPhotos = photosCache.getRandomizedPhotos(); // Get ALL photos, no limit
        // debug removed: cached photos length logging
        if (cachedPhotos.length > 0) {
          setBackgroundImages(cachedPhotos);
          setCurrentBg(0);
          return;
        }

        // Fallback to fetching if no cache
        // debug removed: no cached photos logging
        const albumImages = await getImagesFromAlbum(publicAlbumUrl);
        if (albumImages.length > 0) {
          const randomizedImages = [...albumImages].sort(() => Math.random() - 0.5);
          setBackgroundImages(randomizedImages);
          setCurrentBg(0);
        } else {
          // debug removed: no album images found logging
          setBackgroundImages(getDefaultBackgroundImages());
        }
      } catch (error) {
        console.warn('🖼️ Index.tsx - Failed to load album images, using defaults:', error);
        setBackgroundImages(getDefaultBackgroundImages());
      }
    } else {
      // debug removed: no publicAlbumUrl logging
      setBackgroundImages(getDefaultBackgroundImages());
    }
  }, [publicAlbumUrl]);

  // Load background images when component mounts or album URL changes
  useEffect(() => {
    loadBackgroundImages();
  }, [loadBackgroundImages]);

  // Optimized background rotation with seamless fade transitions
  useEffect(() => {
    if (backgroundImages.length <= 1) return;
    const intervalTime = backgroundDuration * 60 * 1000;
    IntervalManager.setInterval('background-rotation', () => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentBg(prev => (prev + 1) % backgroundImages.length);
        setIsTransitioning(false);
      }, 500); // Half of transition duration
    }, intervalTime);
    return () => {
      IntervalManager.clearInterval('background-rotation');
    };
  }, [backgroundDuration, backgroundImages.length]);

  // Memoized background style with preloading and seamless transitions
  const backgroundStyle = useMemo(() => {
    const currentImage = backgroundImages[currentBg];

    // Preload next image for smooth transitions
    if (backgroundImages.length > 1) {
      const nextIndex = (currentBg + 1) % backgroundImages.length;
      const nextImage = new Image();
      nextImage.src = backgroundImages[nextIndex];
    }
    return {
      backgroundImage: `url("${currentImage}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      opacity: isTransitioning ? 0 : 1,
      transition: 'opacity 1s ease-in-out'
    };
  }, [backgroundImages, currentBg, isTransitioning]);

  // Responsive time formatting - only update when time changes
  const formattedTime = useMemo(() => {
    return currentTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }, [currentTime]);
  return <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Background Image with seamless fade transitions */}
      <div className="fixed inset-0 w-full h-full" style={backgroundStyle} />
      
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] dark:bg-black/20 z-10" />
      
      {/* Right side gradient overlay */}
      <div className="fixed top-0 right-0 h-full w-[120px] bg-gradient-to-l from-black/50 to-transparent z-15 pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-20 min-h-screen flex flex-col">
        {/* Responsive Header with gradient overlay - Fixed positioning */}
        <header className="fixed top-0 left-0 right-0 z-30 flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 md:p-6">
          {/* Header gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent pointer-events-none" />
          
          {/* Responsive Time Display */}
          <div className="relative z-10 flex items-baseline gap-1 sm:gap-2 mb-2 sm:mb-0">
            <h1 className="text-white/90 font-semibold text-4xl sm:text-5xl lg:text-7xl xl:text-8xl md:text-7xl">
              {formattedTime.replace(/ [AP]M/, '')}
            </h1>
            <span className="text-white/90 font-semibold text-xl sm:text-2xl md:text-3xl lg:text-4xl">
              {formattedTime.match(/[AP]M/)?.[0]}
            </span>
          </div>
          
          {/* Responsive Weather Widget */}
          <div className="flex items-center gap-2 sm:gap-4 relative z-10 w-full sm:w-auto justify-end">
            <WeatherWidget />
          </div>
        </header>

        {/* Main Content - Responsive top padding to account for fixed header */}
        <main className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6 pt-20 sm:pt-24 md:pt-28 lg:pt-32 flex-1 flex flex-col overflow-visible">
          <div className="flex-1">
            <Calendar onNotionEventClick={handleNotionEventClick} />
          </div>
        </main>
      </div>

      {/* Responsive Settings Button - Fixed in lower right corner */}
      <Button variant="ghost" size="sm" onClick={() => openSettingsModal()} className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 md:bottom-6 md:right-6 z-20 text-white hover:bg-white/20 bg-black/20 backdrop-blur-sm border border-white/20 h-10 w-10 sm:h-11 sm:w-11 p-0">
        <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
      </Button>

      <NotionEventModal open={isNotionModalOpen} onOpenChange={setIsNotionModalOpen} event={selectedNotionEvent} />
    </div>;
};
export default Index;