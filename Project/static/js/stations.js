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
      console.error("Station Load Error:", error.message);
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
      return [];
    }
    
    // Filter out stations that already have valid cached data
    const stationsToFetch = stationIds.filter(id => {
      const cached = AVAILABILITY_CACHE[id];
      return !cached || Date.now() - cached.timestamp >= CACHE_EXPIRY;
    });
    
    if (stationsToFetch.length === 0) {
      return stationIds.map(id => AVAILABILITY_CACHE[id]?.data);
    }
    
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
          loadStationsAvailability(stationsToRefresh);
        }
      }
    }, CACHE_EXPIRY);
  }

  // Get user's current location
  async function getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn("Geolocation error:", error.message);
          // If geolocation fails, use Dublin city center as fallback
          resolve({
            lat: 53.3498,
            lng: -6.2603
          });
        },
        options
      );
    });
  }

  // Find nearest station with available bikes
  async function findNearestAvailableBike() {
    try {
      const userLocation = await getUserLocation();

      // Get all stations with availability data
      const stations = stationData;
      if (!stations || stations.length === 0) {
        throw new Error("No station data available");
      }

      // First pass: Find nearest station with bikes using cached data
      let nearestStation = null;
      let minDistance = Infinity;

      for (const station of stations) {
        const stationLat = parseFloat(station.position.lat);
        const stationLng = parseFloat(station.position.lng);

        if (isNaN(stationLat) || isNaN(stationLng)) {
          console.warn("Invalid coordinates for station:", station);
          continue;
        }

        // Calculate distance using Haversine formula
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          stationLat,
          stationLng
        );

        // Check cached availability first
        const cachedAvailability = AVAILABILITY_CACHE[station.number];
        if (cachedAvailability && 
            cachedAvailability.timestamp > Date.now() - CACHE_EXPIRY && 
            cachedAvailability.available_bikes > 0 && 
            distance < minDistance) {
          minDistance = distance;
          nearestStation = station;
        }
      }

      // If no station found in cache, try fetching availability for the closest stations
      if (!nearestStation) {
        // Sort stations by distance
        const sortedStations = stations
          .map(station => ({
            station,
            distance: calculateDistance(
              userLocation.lat,
              userLocation.lng,
              parseFloat(station.position.lat),
              parseFloat(station.position.lng)
            )
          }))
          .sort((a, b) => a.distance - b.distance);

        // Check the 5 closest stations
        for (let i = 0; i < Math.min(5, sortedStations.length); i++) {
          const { station } = sortedStations[i];
          const availability = await fetchAvailability(station.number);
          if (availability.available_bikes > 0) {
            nearestStation = station;
            break;
          }
        }
      }

      if (!nearestStation) {
        throw new Error("No stations with available bikes found");
      }
      
      // Center map on the station and show directions
      if (window.MapModule) {
        // First center the map on the station
        window.MapModule.centerOnStation(nearestStation);
        
        // Then show directions
        if (window.MapModule.showDirections) {
          await window.MapModule.showDirections(userLocation, nearestStation);
        } else {
          console.error("MapModule.showDirections is not available");
        }

        // Open station info panel
        if (window.UIModule && window.UIModule.showStationInfo) {
          window.UIModule.showStationInfo(nearestStation);
        }
      } else {
        console.error("MapModule is not available");
      }
      
      return nearestStation;
    } catch (error) {
      console.error("Error finding nearest bike:", error);
      throw error;
    }
  }

  // Calculate distance between two points using Haversine formula
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRad(degrees) {
    return degrees * (Math.PI / 180);
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