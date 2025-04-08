const StationsModule = (function () {
  let stationData = [];
  const AVAILABILITY_CACHE = {};
  const PENDING_REQUESTS = {};
  const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds
  const MAX_CONCURRENT_REQUESTS = 6; // Match browser limits
  const REQUEST_QUEUE = [];
  let activeRequests = 0;
  let refreshInterval = null;
  let isProcessingQueue = false;

  // Load station data from API
  async function loadStations() {
    try {
      const response = await fetch("/stations");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      stationData = data.stations || [];

      if (stationData.length === 0) {
        throw new Error("No station data available");
      }

      console.log("✅ Stations successfully loaded:", stationData.length);

      // Add markers for initially visible stations only
      if (window.MapModule) {
        const initialStations = stationData.slice(0, 50);
        window.MapModule.addMarkers(initialStations);
        // Only load availability for visible stations
        await loadStationsAvailability(initialStations.map((s) => s.number));
      }

      if (window.UIModule) {
        window.UIModule.populateDropdown(stationData);
        window.UIModule.setupStationSearch();
      }

      // Set up periodic refresh for visible stations
      setupPeriodicRefresh();

      return stationData;
    } catch (error) {
      console.error("❌ Station Load Error:", error.message);
      UIModule?.showError("Could not load station data. Try again later.");
      return [];
    }
  }

  // Process the request queue
  async function processQueue() {
    if (isProcessingQueue || REQUEST_QUEUE.length === 0) return;
    
    isProcessingQueue = true;
    
    try {
      while (REQUEST_QUEUE.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
        const process = REQUEST_QUEUE.shift();
        activeRequests++;
        
        try {
          await process();
        } catch (error) {
          console.warn("Error processing request:", error);
        } finally {
          activeRequests--;
        }
      }
    } finally {
      isProcessingQueue = false;
      
      // If there are still items in the queue, schedule another processing run
      if (REQUEST_QUEUE.length > 0) {
        setTimeout(processQueue, 10);
      }
    }
  }

  async function throttledFetch(url, stationId) {
    // Return existing promise if this station request is already in progress
    if (stationId && PENDING_REQUESTS[stationId]) {
      return PENDING_REQUESTS[stationId];
    }

    const fetchPromise = new Promise((resolve) => {
      const process = async () => {
        try {
          const response = await fetch(url);
          resolve(response.ok ? await response.json() : null);
        } catch (error) {
          console.warn(`Error fetching ${url}:`, error);
          resolve(null);
        } finally {
          if (stationId) delete PENDING_REQUESTS[stationId];
        }
      };

      if (activeRequests < MAX_CONCURRENT_REQUESTS) {
        activeRequests++;
        process().finally(() => {
          activeRequests--;
          processQueue();
        });
      } else {
        REQUEST_QUEUE.push(process);
        processQueue();
      }
    });

    if (stationId) {
      PENDING_REQUESTS[stationId] = fetchPromise;
    }

    return fetchPromise;
  }

  async function fetchAvailability(station_id) {
    // Check cache first
    if (
      AVAILABILITY_CACHE[station_id] &&
      Date.now() - AVAILABILITY_CACHE[station_id].timestamp < CACHE_EXPIRY
    ) {
      return AVAILABILITY_CACHE[station_id].data;
    }

    // Pass the station_id to track pending requests
    const data = await throttledFetch(`/available/${station_id}`, station_id);
    if (!data) {
      console.warn(`⚠️ No availability data found for station ${station_id}`);
      return { available_bikes: 0, available_bike_stands: 0 };
    }

    // Store in cache
    AVAILABILITY_CACHE[station_id] = {
      data,
      timestamp: Date.now(),
    };

    return data;
  }

  async function loadStationsAvailability(stationIds) {
    if (!stationIds || stationIds.length === 0) {
      console.log("No station IDs provided for availability check");
      return [];
    }
    
    console.log(`Fetching availability for ${stationIds.length} stations...`);

    // Filter out stations that already have valid cached data
    const stationsToFetch = stationIds.filter(id => {
      const cached = AVAILABILITY_CACHE[id];
      return !cached || Date.now() - cached.timestamp >= CACHE_EXPIRY;
    });
    
    if (stationsToFetch.length === 0) {
      console.log("All stations have valid cached data, no fetch needed");
      return stationIds.map(id => AVAILABILITY_CACHE[id]?.data);
    }
    
    console.log(`Actually fetching ${stationsToFetch.length} stations (others cached)`);
    
    // Process in batches to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < stationsToFetch.length; i += batchSize) {
      const batch = stationsToFetch.slice(i, i + batchSize);
      const availabilityPromises = batch.map(id => fetchAvailability(id));
      await Promise.all(availabilityPromises);
    }

    return stationIds.map(id => AVAILABILITY_CACHE[id]?.data);
  }

  // Load all availability data - only if necessary
  async function loadAllAvailability() {
    console.warn("Loading ALL station availability - this is expensive!");
    const stationNumbers = stationData.map((station) => station.number);
    return loadStationsAvailability(stationNumbers);
  }

  function setupPeriodicRefresh() {
    // Clear any existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    // Set a reasonable refresh interval (5 minutes)
    refreshInterval = setInterval(() => {
      // Get IDs of stations currently visible on the map
      const visibleStationIds = window.MapModule?.getVisibleStations?.() || [];

      // Only refresh what the user can see
      if (visibleStationIds.length > 0) {
        // Only refresh stations with expired cache
        const stationsToRefresh = visibleStationIds.filter(id => {
          const cached = AVAILABILITY_CACHE[id];
          return !cached || Date.now() - cached.timestamp >= CACHE_EXPIRY;
        });
        
        if (stationsToRefresh.length > 0) {
          console.log(`Refreshing ${stationsToRefresh.length} stations with expired cache`);
          loadStationsAvailability(stationsToRefresh);
        }
      }
    }, CACHE_EXPIRY);
  }

  // Get user's current location
  async function getUserLocation() {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => {
            reject(new Error("Unable to retrieve location"));
          }
        );
      } else {
        reject(new Error("Geolocation not supported"));
      }
    });
  }

  // Find the nearest station with available bikes using cached data
  async function findNearestAvailableBike() {
    console.log("findNearestAvailableBike() started");
    try {
      const userLocation = await getUserLocation();
      console.log("User Location:", userLocation);

      if (!stationData || stationData.length === 0) {
        throw new Error("No stations available.");
      }

      // Find stations near the user first to minimize requests
      const nearbyStations = stationData
        .map((station) => {
          const distance = window.UtilsModule.calculateDistance(
            userLocation.lat,
            userLocation.lng,
            parseFloat(station.position_lat),
            parseFloat(station.position_lng)
          );
          return { ...station, distance };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 15); // Check only closest 15 stations

      // Ensure we have fresh availability data for nearby stations
      await loadStationsAvailability(nearbyStations.map((s) => s.number));

      // Filter stations with available bikes
      const availableStations = nearbyStations.filter((station) => {
        const availability = AVAILABILITY_CACHE[station.number]?.data;
        return availability && availability.available_bikes > 0;
      });

      if (availableStations.length === 0) {
        UIModule?.showAlert("No available bikes found nearby. Try another location.");
        return null;
      }

      // Get the closest station with available bikes
      const nearestStation = availableStations[0];
      console.log("Nearest available station:", nearestStation);

      // Center map on the station
      if (window.MapModule) {
        window.MapModule.centerOnStation(nearestStation);
        
        // Show directions to the nearest station
        if (window.MapModule.showDirections) {
          // Set user location marker
          window.MapModule.setUserLocationMarker(userLocation);
          
          // Show directions from user location to the nearest station
          window.MapModule.showDirections(userLocation, nearestStation);
        } else {
          console.warn("MapModule.showDirections is not available");
        }
      }

      // Show station info
      if (window.UIModule) {
        window.UIModule.showStationInfo(nearestStation);
      }

      return nearestStation;
    } catch (error) {
      console.error("Error finding nearest bike:", error);
      UIModule?.showError("Could not find nearest bike. Please try again.");
      return null;
    }
  }

  function resetApp() {
    // Clear all caches
    Object.keys(AVAILABILITY_CACHE).forEach(key => {
      delete AVAILABILITY_CACHE[key];
    });
    
    // Clear all pending requests
    Object.keys(PENDING_REQUESTS).forEach(key => {
      delete PENDING_REQUESTS[key];
    });
    
    // Reset request queue
    REQUEST_QUEUE.length = 0;
    activeRequests = 0;
    
    // Reload stations
    loadStations();
  }

  // Public API
  return {
    loadStations,
    fetchAvailability,
    loadStationsAvailability,
    loadAllAvailability,
    findNearestAvailableBike,
    getUserLocation,
    resetApp,
    getStationData: () => stationData,
    getCache: () => AVAILABILITY_CACHE,
  };
})();

// Make StationsModule available
window.StationsModule = StationsModule;