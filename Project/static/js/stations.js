const StationsModule = (function () {
  let stationData = [];
  const AVAILABILITY_CACHE = {};
  const PENDING_REQUESTS = {};
  const CACHE_EXPIRY = Infinity;
  const MAX_CONCURRENT_REQUESTS = 6; // Match browser limits
  let activeRequests = 0;
  const REQUEST_QUEUE = [];

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

  async function throttledFetch(url, stationId) {
    // Return existing promise if this station request is already in progress
    if (stationId && PENDING_REQUESTS[stationId]) {
      return PENDING_REQUESTS[stationId];
    }

    const fetchPromise = new Promise((resolve) => {
      const process = async () => {
        activeRequests++;
        try {
          const response = await fetch(url);
          resolve(response.ok ? await response.json() : null);
        } catch {
          resolve(null);
        } finally {
          activeRequests--;
          if (stationId) delete PENDING_REQUESTS[stationId];
          if (REQUEST_QUEUE.length > 0) {
            REQUEST_QUEUE.shift()();
          }
        }
      };

      if (activeRequests < MAX_CONCURRENT_REQUESTS) {
        process();
      } else {
        REQUEST_QUEUE.push(process);
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
    console.log(`Fetching availability for ${stationIds.length} stations...`);

    const availabilityPromises = stationIds.map((id) => fetchAvailability(id));
    await Promise.all(availabilityPromises);

    return stationIds.map((id) => AVAILABILITY_CACHE[id]?.data);
  }

  // Load all availability data - only if absolutely necessary
  async function loadAllAvailability() {
    console.warn("Loading ALL station availability - this is expensive!");
    const stationNumbers = stationData.map((station) => station.number);
    return loadStationsAvailability(stationNumbers);
  }

  function setupPeriodicRefresh() {
    setInterval(() => {
      // Get IDs of stations currently visible on the map
      const visibleStationIds = window.MapModule?.getVisibleStations?.() || [];

      // Only refresh what the user can see
      if (visibleStationIds.length > 0) {
        // Force refresh by invalidating cache
        visibleStationIds.forEach((id) => {
          if (AVAILABILITY_CACHE[id]) {
            AVAILABILITY_CACHE[id].timestamp = 0;
          }
        });

        loadStationsAvailability(visibleStationIds);
      }
    }, CACHE_EXPIRY);
  }

  // Get user's current position (geolocation)
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
        throw new Error("No available bikes found nearby.");
      }

      // Nearest available station is the first one
      const nearestStation = availableStations[0];
      console.log("Nearest Station:", nearestStation);

      // Show directions & update UI
      if (window.MapModule) {
        window.MapModule.centerOnStation(nearestStation);
        window.MapModule.setUserLocationMarker(userLocation);
        await window.MapModule.showDirections(userLocation, nearestStation);
      }

      if (window.UIModule) {
        window.UIModule.showStationInfo(nearestStation);
        window.UIModule.showResetButton();
      }

      return nearestStation;
    } catch (error) {
      console.error("Find bike error:", error);
      window.UIModule?.showAlert(
        "Error finding nearest bike: " + error.message
      );
      return null;
    }
  }

  // Reset the app to the default state
  function resetApp() {
    if (window.MapModule) window.MapModule.resetView();

    const stationSelect = document.getElementById("stationSelect");
    if (stationSelect) stationSelect.value = "";

    const stationInfo = document.getElementById("stationInfo");
    if (stationInfo) stationInfo.style.display = "none";

    const directionsPanel = document.getElementById("directions-panel");
    if (directionsPanel) directionsPanel.style.display = "none";
  }

  // Public API
  return {
    loadStations,
    loadStationsAvailability,
    loadAllAvailability,
    fetchAvailability,
    findNearestAvailableBike,
    getStationData: () => stationData,
    getCache: () => AVAILABILITY_CACHE,
    getUserLocation,
    resetApp,
  };
})();

window.StationsModule = StationsModule;
