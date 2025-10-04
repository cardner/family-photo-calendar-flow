// Increment CACHE_NAME when making breaking cache changes
const CACHE_VERSION = 'fp-calendar-v3';
const CACHE_NAME = `${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Do not touch cross-origin requests such as the Notion API.
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch((error) => {
          console.error('[SW] fetch failed:', request.url, error);
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
    }).catch((error) => {
      console.error('[SW] handler error:', request.url, error);
      return new Response('Service Worker Error', { status: 500 });
    })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'calendar-sync') {
    event.waitUntil(syncCalendarsInBackground());
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic background sync triggered:', event.tag);
  
  if (event.tag === 'calendar-periodic-sync') {
    event.waitUntil(syncCalendarsInBackground());
  }
});

// Background calendar sync function
async function syncCalendarsInBackground() {
  try {
    console.log('Starting background calendar sync');
    
    // Get stored calendars from IndexedDB
    const calendars = await getStoredCalendars();
    const enabledCalendars = calendars.filter(cal => cal.enabled);
    
    if (enabledCalendars.length === 0) {
      console.log('No enabled calendars to sync');
      return;
    }
    
    let syncedCount = 0;
    let errorCount = 0;
    
    for (const calendar of enabledCalendars) {
      try {
        await syncSingleCalendar(calendar);
        syncedCount++;
        console.log(`Successfully synced calendar: ${calendar.name}`);
      } catch (error) {
        errorCount++;
        console.error(`Failed to sync calendar ${calendar.name}:`, error);
      }
    }
    
    // Store sync results
    const syncResult = {
      timestamp: new Date().toISOString(),
      syncedCount,
      errorCount,
      totalCalendars: enabledCalendars.length
    };
    
    // Notify the main thread about sync completion
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_COMPLETE',
        result: syncResult
      });
    });
    
    console.log('Background sync completed:', syncResult);
    
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Helper function to get calendars from IndexedDB
async function getStoredCalendars() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FamilyCalendarDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const allCalendars = [];
      
      // Get iCal calendars
      if (db.objectStoreNames.contains('calendar_feeds')) {
        const transaction1 = db.transaction(['calendar_feeds'], 'readonly');
        const store1 = transaction1.objectStore('calendar_feeds');
        const getAllRequest1 = store1.getAll();
        
        getAllRequest1.onsuccess = () => {
          const icalCalendars = getAllRequest1.result || [];
          allCalendars.push(...icalCalendars);
          
          // Get Notion calendars
          if (db.objectStoreNames.contains('notion_scraped_calendars')) {
            const transaction2 = db.transaction(['notion_scraped_calendars'], 'readonly');
            const store2 = transaction2.objectStore('notion_scraped_calendars');
            const getAllRequest2 = store2.getAll();
            
            getAllRequest2.onsuccess = () => {
              const notionCalendars = getAllRequest2.result || [];
              allCalendars.push(...notionCalendars);
              resolve(allCalendars);
            };
            getAllRequest2.onerror = () => reject(getAllRequest2.error);
          } else {
            resolve(allCalendars);
          }
        };
        getAllRequest1.onerror = () => reject(getAllRequest1.error);
      } else {
        // Just try Notion calendars if no iCal feeds
        if (db.objectStoreNames.contains('notion_scraped_calendars')) {
          const transaction = db.transaction(['notion_scraped_calendars'], 'readonly');
          const store = transaction.objectStore('notion_scraped_calendars');
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            const notionCalendars = getAllRequest.result || [];
            resolve(notionCalendars);
          };
          getAllRequest.onerror = () => reject(getAllRequest.error);
        } else {
          resolve([]);
        }
      }
    };
  });
}

// Helper function to sync a single calendar
async function syncSingleCalendar(calendar) {
  const CORS_PROXIES = [
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url) => `https://cors-anywhere.herokuapp.com/${url}`,
    (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
    (url) => `https://cors.bridged.cc/${url}`,
  ];
  
  // Try direct fetch first, then proxies
  let icalData = null;
  
  try {
    const response = await fetch(calendar.url, {
      mode: 'cors',
      headers: {
        'Accept': 'text/calendar, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; FamilyCalendarApp/1.0)',
      }
    });
    
    if (response.ok) {
      const data = await response.text();
      if (data && data.toLowerCase().includes('begin:vcalendar')) {
        icalData = data;
      }
    }
  } catch (error) {
    // Direct fetch failed, try proxies
  }
  
  // Try proxies if direct fetch failed
  if (!icalData) {
    for (const proxy of CORS_PROXIES) {
      try {
        const proxyUrl = proxy(calendar.url);
        const response = await fetch(proxyUrl);
        
        if (response.ok) {
          const data = await response.text();
          if (data && data.toLowerCase().includes('begin:vcalendar')) {
            icalData = data;
            break;
          }
        }
      } catch (error) {
        // Continue to next proxy
      }
    }
  }
  
  if (!icalData) {
    throw new Error('Failed to fetch calendar data from all sources');
  }
  
  // Store the raw iCal data temporarily for the main thread to process
  // We can't import ICAL.js in the service worker, so we'll let the main thread handle parsing
  const syncData = {
    calendarId: calendar.id,
    icalData: icalData,
    syncTime: new Date().toISOString(),
    isBackgroundSync: true // Flag to indicate this came from background sync
  };
  
  // Store in a temporary location for the main thread to pick up
  const request = indexedDB.open('FamilyCalendarDB', 1);
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      
      // Create a temporary store for sync data if it doesn't exist
      if (!db.objectStoreNames.contains('sync_queue')) {
        // Can't modify schema here, so we'll use localStorage as fallback
        try {
          const existingQueue = JSON.parse(localStorage.getItem('calendar_sync_queue') || '[]');
          existingQueue.push(syncData);
          localStorage.setItem('calendar_sync_queue', JSON.stringify(existingQueue));
          resolve();
        } catch (error) {
          reject(error);
        }
        return;
      }
      
      const transaction = db.transaction(['sync_queue'], 'readwrite');
      const store = transaction.objectStore('sync_queue');
      const addRequest = store.add(syncData);
      
      addRequest.onerror = () => reject(addRequest.error);
      addRequest.onsuccess = () => resolve();
    };
  });
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'REGISTER_BACKGROUND_SYNC') {
    // Register for background sync
    self.registration.sync.register('calendar-sync')
      .then(() => {
        console.log('Background sync registered successfully');
        event.ports[0]?.postMessage({ success: true });
      })
      .catch((error) => {
        console.error('Failed to register background sync:', error);
        event.ports[0]?.postMessage({ success: false, error: error.message });
      });
  } else if (event.data && event.data.type === 'REGISTER_PERIODIC_SYNC') {
    // Register for periodic background sync (if supported)
    if ('periodicSync' in self.registration) {
      self.registration.periodicSync.register('calendar-periodic-sync', {
        minInterval: 60 * 60 * 1000, // 1 hour
      })
        .then(() => {
          console.log('Periodic background sync registered successfully');
          event.ports[0]?.postMessage({ success: true });
        })
        .catch((error) => {
          console.error('Failed to register periodic background sync:', error);
          event.ports[0]?.postMessage({ success: false, error: error.message });
        });
    } else {
      event.ports[0]?.postMessage({ success: false, error: 'Periodic sync not supported' });
    }
  }
});
