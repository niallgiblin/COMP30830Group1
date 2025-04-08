// Map management module
const MapModule = (function () {
  const DEFAULT_ZOOM = 14;
  const DEFAULT_MAP_CENTER = { lat: 53.3455, lng: -6.2708 };
  let map;
  let markers = [];
  let userLocationMarker = null;
  let directionsRenderer;
  let onMarkerClickCallback = null;
  let directionsService;
  let markerUpdateTimeout = null;

  // Custom map styles to hide certain POIs for better performance
  const mapStyles = [
    {
      featureType: "poi.business",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "poi.attraction",
      elementType: "labels",
      stylers: [{ visibility: "on" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels",
      stylers: [{ visibility: "on" }],
    },
    {
      featureType: "poi.sports_complex",
      elementType: "labels",
      stylers: [{ visibility: "on" }],
    },
    {
      featureType: "transit",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
  ];

  // Initialize the map
  function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
      zoom: DEFAULT_ZOOM,
      center: DEFAULT_MAP_CENTER,
      styles: mapStyles,
      mapTypeControl: false,
      streetViewControl: false,
      zoomControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      maxZoom: 19,
      minZoom: 10,
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: false,
      panel: document.getElementById("directions-steps"),
    });

    // Delay marker creation until tiles load
    google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
      // Use requestAnimationFrame to avoid blocking the main thread
      requestAnimationFrame(() => {
        const stations = StationsModule.getStationData();
        if (stations.length > 0) {
          addMarkersToMap(stations);
        }
      });
    });

    // Initialize reset button
    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", resetToDefaultView);
      // Hide reset button initially
      resetBtn.style.display = "none";
    }

    initDirectionsService();
    return map;
  }

  // Reset map to default view
  function resetToDefaultView() {
    // Reset map position and zoom
    map.setCenter(DEFAULT_MAP_CENTER);
    map.setZoom(DEFAULT_ZOOM);

    // Clear any directions
    if (directionsRenderer) {
      directionsRenderer.setMap(null);
    }

    // Remove user location marker
    if (userLocationMarker) {
      userLocationMarker.setMap(null);
      userLocationMarker = null;
    }

    // Reset station selection
    document.getElementById("stationSelect").value = "";

    // Hide station info
    document.getElementById("stationInfo").style.display = "none";

    // Hide directions panel
    document.getElementById("directions-panel").style.display = "none";

    // Close the Find a Station modal
    if (typeof window.closeModal === 'function') {
      window.closeModal('station');
    }

    // Reset all markers to default appearance
    resetMarkersToDefault();

    // Hide reset button after reset
    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
      resetBtn.style.display = "none";
    }
  }

  // Add station markers to the map
  function addMarkersToMap(stations) {
    // Clear existing markers first
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    // Process markers in batches to avoid blocking the main thread
    const batchSize = 20;
    let currentIndex = 0;
    
    function processBatch() {
      const endIndex = Math.min(currentIndex + batchSize, stations.length);
      
      for (let i = currentIndex; i < endIndex; i++) {
        const station = stations[i];
        const lat = parseFloat(station.position_lat);
        const lng = parseFloat(station.position_lng);

        if (isNaN(lat) || isNaN(lng)) {
          console.error("Invalid coordinates for station:", station);
          continue;
        }

        const stationLocation = { lat, lng };
        const marker = new google.maps.Marker({
          position: stationLocation,
          map: map,
          title: station.name,
          optimized: true,
          animation: null,
        });

        marker.addListener("click", () => {
          // Use requestAnimationFrame to avoid blocking the main thread
          requestAnimationFrame(() => {
            centerMapOnStation(station);
            document.getElementById("stationSelect").value = station.number;

            // Make sure UI updates with station data
            if (window.UIModule) {
              window.UIModule.showStationInfo(station);
            } else {
              console.warn("UIModule is not loaded!");
            }

            if (typeof openModal === 'function') {
              openModal('station'); // Show the "Find station modal" when clicked on station marker
            }

            if (onMarkerClickCallback) onMarkerClickCallback(station);
          });
        });

        markers.push(marker);
      }
      
      currentIndex = endIndex;
      
      // If there are more markers to process, schedule the next batch
      if (currentIndex < stations.length) {
        // Use setTimeout with 0ms delay to yield to the main thread
        setTimeout(processBatch, 0);
      }
    }
    
    // Start processing the first batch
    processBatch();
  }

  function setOnMarkerClick(callback) {
    onMarkerClickCallback = callback;
  }

  // Center map on specific station
  function centerMapOnStation(station) {
    const stationLocation = {
      lat: parseFloat(station.position_lat),
      lng: parseFloat(station.position_lng),
    };
    map.setCenter(stationLocation);
    map.setZoom(18);
  }

  // Initialize directions service
  function initDirectionsService() {
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);
  }

  // Show route directions between two points
  function showDirections(origin, destinationStation) {
    return new Promise((resolve) => {
      // Use requestAnimationFrame to avoid blocking the main thread
      requestAnimationFrame(() => {
        // 1. Clear previous directions completely
        if (directionsRenderer) {
          directionsRenderer.setMap(null);
          directionsRenderer = null;
        }

        // 2. Create fresh renderer instance
        directionsRenderer = new google.maps.DirectionsRenderer({
          suppressMarkers: false,
          preserveViewport: true,
        });

        // 3. Attach to map
        directionsRenderer.setMap(map);

        // 4. Calculate route
        directionsService.route({
          origin: origin,
          destination: {
            lat: parseFloat(destinationStation.position_lat),
            lng: parseFloat(destinationStation.position_lng)
          },
          travelMode: google.maps.TravelMode.WALKING
        }, (response, status) => {
          if (status === 'OK') {
            directionsRenderer.setDirections(response);
            
            // Make the directions panel visible
            const directionsPanel = document.getElementById("directions-panel");
            if (directionsPanel) {
              directionsPanel.style.display = "block";
            } else {
              console.warn("Directions panel element not found");
            }
            
            // Display step-by-step directions in the UI
            if (window.DirectionsModule && window.DirectionsModule.displayStepByStepDirections) {
              window.DirectionsModule.displayStepByStepDirections(response);
            } else {
              console.warn("DirectionsModule.displayStepByStepDirections is not available");
            }
            
            resolve();
          } else {
            console.error('Directions failed:', status);
            resolve(); // Don't break the UI
          }
        });
      });
    });
  }

  // Set user location marker
  function setUserLocationMarker(position) {
    if (userLocationMarker) userLocationMarker.setMap(null);

    userLocationMarker = new google.maps.Marker({
      position: position,
      map: map,
      title: "Your Location",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#4285F4",
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "white",
      },
      // Add these options to improve performance
      optimized: true,
    });

    return userLocationMarker;
  }

  function resetMarkersToDefault() {
    // Process all markers at once instead of using recursive setTimeout
    // This is more efficient and reduces violations
    markers.forEach(marker => {
      marker.setIcon(null); // Default icon
      marker.setAnimation(null); // Stop any animations
    });
  }

  // Get stations currently visible in the map viewport
  function getVisibleStations() {
    if (!map || !markers || markers.length === 0) {
      return [];
    }

    const bounds = map.getBounds();
    if (!bounds) {
      return [];
    }

    // Get all station data
    const allStations = window.StationsModule?.getStationData() || [];
    
    // Filter stations that are within the current map bounds
    const visibleStations = allStations.filter(station => {
      const lat = parseFloat(station.position_lat);
      const lng = parseFloat(station.position_lng);
      
      if (isNaN(lat) || isNaN(lng)) {
        return false;
      }
      
      const position = new google.maps.LatLng(lat, lng);
      return bounds.contains(position);
    });
    
    // Return just the station numbers
    return visibleStations.map(station => station.number);
  }

  // Public API
  return {
    init: initMap,
    resetView: resetToDefaultView,
    addMarkers: addMarkersToMap,
    centerOnStation: centerMapOnStation,
    showDirections: showDirections,
    setUserLocationMarker: setUserLocationMarker,
    setOnMarkerClick: setOnMarkerClick,
    getVisibleStations: getVisibleStations,
  };
})();

window.MapModule = MapModule;