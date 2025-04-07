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
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: false,
      panel: document.getElementById("directions-steps"),
    });

          // Delay marker creation until tiles load
    google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
      const stations = StationsModule.getStationData();
      if (stations.length > 0) {
        addMarkersToMap(stations);
      }
    });

    const controls = document.getElementById("controls");
    const resetBtn = document.getElementById("resetBtn");
    resetBtn.style.top = `${controls.offsetHeight + 20}px`;
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

    // Reset all markers to default appearance
    resetMarkersToDefault(); // Now this will work
  }

  // Add station markers to the map
function addMarkersToMap(stations) {
  markers = [];

  stations.forEach((station) => {
    const lat = parseFloat(station.position_lat);
    const lng = parseFloat(station.position_lng);

    if (isNaN(lat) || isNaN(lng)) {
      console.error("Invalid coordinates for station:", station);
      return;
    }

    const stationLocation = { lat, lng };
    const marker = new google.maps.Marker({
      position: stationLocation,
      map: map,
      title: station.name,
    });

    marker.addListener("click", () => {
      centerMapOnStation(station);
      document.getElementById("stationSelect").value = station.number;

      // 🔥 Make sure UI updates with station data
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

    markers.push(marker);
  });
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
    // 1. Clear previous directions completely
    if (directionsRenderer) {
      directionsRenderer.setMap(null);
      directionsRenderer = null;
    }

    // 2. Create fresh renderer instance
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: false,
      preserveViewport: true,
      panel: document.getElementById("directions-steps")
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
        document.getElementById("directions-panel").style.display = "block";
        resolve();
      } else {
        console.error('Directions failed:', status);
        resolve(); // Don't break the UI
      }
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
    });

    return userLocationMarker;
  }

  function resetMarkersToDefault() {
    markers.forEach((marker) => {
      // Reset marker appearance to default
      marker.setIcon(null); // Default icon
      marker.setAnimation(null); // Stop any animations
    });
  }

  // Public API
  return {
    init: initMap,
    resetView: resetToDefaultView,
    addMarkers: addMarkersToMap,
    centerOnStation: centerMapOnStation,
    showDirections: showDirections,
    setUserLocationMarker: setUserLocationMarker,
    getMap: () => map,
    setOnMarkerClick
  };
})();

window.MapModule = MapModule;