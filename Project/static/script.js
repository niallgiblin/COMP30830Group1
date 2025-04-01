let stationData = []; // Store JSON data globally
let map; // Store the map object globally
let markers = []; // Store markers for later reference

// Load station data from JSON
function loadStations() {
  fetch("/stations")
    .then((response) => response.json())
    .then((data) => {
      console.log("Fetched station data:", data); // Debugging
      stationData = data.stations; // Store globally
      populateDropdown(data.stations);
      setupStationSearch(data.stations);
      addMarkersToMap(data.stations); // Add markers to the map
    })
    .catch((error) => console.error("Error loading stations:", error));
}

// Populate the dropdown menu
function populateDropdown(stations) {
  const uniqueStations = [
    ...new Map(stations.map((station) => [station.number, station])).values(),
  ];
  const sortedStations = uniqueStations.sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  let dropdown = document.getElementById("stationSelect");
  dropdown.innerHTML = "<option value=''>Select a station</option>"; // Reset dropdown
  sortedStations.forEach((station) => {
    let option = document.createElement("option");
    option.value = station.number;
    option.textContent = station.name;
    dropdown.appendChild(option);
  });

  // Add event listener for dropdown selection
  dropdown.addEventListener("change", function () {
    let selectedStation = stationData.find((s) => s.number == this.value);
    if (selectedStation) {
      showStationInfo(selectedStation);
      centerMapOnStation(selectedStation); // Center the map on the selected station
    }
  });
}

// Show station information when selected from the dropdown or marker click
function showStationInfo(station) {
  document.getElementById("stationName").textContent = station.name;
  document.getElementById("stationStatus").textContent = station.status;

  // Fetch availability data and update the DOM
  fetchAvailability(station.number).then((availability) => {
    document.getElementById("availableBikes").textContent =
      availability.available_bikes;
    document.getElementById("freeStands").textContent =
      availability.available_bike_stands;
  });

  // Make the station details visible
  document.getElementById("stationInfo").style.display = "block";
}

// Focus on a specific station
function centerMapOnStation(station) {
  const stationLocation = {
    lat: parseFloat(station.position_lat),
    lng: parseFloat(station.position_lng),
  };
  map.setCenter(stationLocation);
  map.setZoom(19);
}

// Add search functionality
function setupStationSearch(stations) {
  const searchInput = document.getElementById("stationSearch");
  const dropdown = document.getElementById("stationSelect");
  
  searchInput.addEventListener("input", function() {
    const searchTerm = this.value.toLowerCase();
    const options = dropdown.options;
    
    // First option is "Select a station"
    for (let i = 1; i < options.length; i++) {
      const stationName = options[i].textContent.toLowerCase();
      options[i].style.display = stationName.includes(searchTerm) ? "" : "none";
    }
    
    // If dropdown is closed, open it when typing
    if (searchTerm.length > 0 && !dropdown.multiple) {
      dropdown.size = Math.min(10, options.length); // Show up to 10 options
      dropdown.style.overflowY = "auto";
    } else {
      dropdown.size = 1;
      dropdown.style.overflowY = "";
    }
  });
  
  // Close the dropdown when clicking elsewhere
  document.addEventListener("click", function(e) {
    if (e.target !== searchInput && e.target !== dropdown) {
      dropdown.size = 1;
    }
  });
  
  // Add keyboard navigation
  searchInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      // Find first visible option and select it
      const options = dropdown.options;
      for (let i = 1; i < options.length; i++) {
        if (options[i].style.display !== "none") {
          dropdown.value = options[i].value;
          dropdown.dispatchEvent(new Event("change"));
          break;
        }
      }
    }
  });
}

// Initialize and add the map
function initMap() {
  const dublin = { lat: 53.3455, lng: -6.2708 };
  const mapStyles = [
    // Hide some POI for better performance
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

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 14,
    center: dublin,
    mapId: "YOUR_MAP_ID",
    styles: mapStyles, // Apply custom styles
    mapTypeControl: false, // Disable map type control (satellite view)
    streetViewControl: false, // Disable street view control
    zoomControl: false, // Disable zoom control
    fullscreenControl: false, // Disable fullscreen control
  });
}

// Add markers for all stations
function addMarkersToMap(stations) {
  console.log("Adding markers for stations:", stations); // Debugging
  stations.forEach((station) => {
    const lat = parseFloat(station.position_lat);
    const lng = parseFloat(station.position_lng);

    // Check if lat and lng are valid numbers
    if (isNaN(lat) || isNaN(lng)) {
      console.error("Invalid lat/lng for station:", station);
      return; // Skip this station
    }

    const stationLocation = { lat, lng };
    console.log("Adding marker at:", stationLocation); // Debugging

    // Create a marker
    const marker = new google.maps.Marker({
      position: stationLocation,
      map: map,
      title: station.name,
    });

    // Add a click listener to the marker
    marker.addListener("click", () => {
      // Zoom in on the marker
      centerMapOnStation(station);

      // Update the dropdown menu with the selected station
      document.getElementById("stationSelect").value = station.number;
      showStationInfo(station);
    });

    markers.push(marker); // Store marker
  });
}

// Fetch availability data for a specific station
function fetchAvailability(station_id) {
  const apiKey = "49e68d2d5153f2954850d6d9fe80295cbe9c62d2";
  const apiUrl = `https://api.jcdecaux.com/vls/v1/stations/${station_id}?contract=dublin&apiKey=${apiKey}`;

  return fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      console.log("Fetched live availability data:", data); // Debugging
      return {
        available_bikes: data.available_bikes || "N/A",
        available_bike_stands: data.available_bike_stands || "N/A",
      };
    })
    .catch((error) => {
      console.error("Error fetching live availability:", error);
      return { available_bikes: "N/A", available_bike_stands: "N/A" };
    });
}

// Fetch and display weather data
function fetchWeather() {
  const apiKey = "6662905812925bbd641b91d8fe237874";
  const city = 'Dublin';
  const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

  fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      console.log("Fetched weather data:", data); // Debugging
      displayWeather(data);
    })
    .catch((error) => console.error("Error fetching weather:", error));
}

// Display weather data in the weather overlay
function displayWeather(weather) {
  const weatherDiv = document.getElementById("weather");
  const temperature = weather.main.temp.toFixed(1); // Round to 1 decimal place
  const description = weather.weather[0].description;
  const icon = weather.weather[0].icon;

  weatherDiv.innerHTML = `
    <div class="weather-card">
      <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${description}">
      <p>${temperature}°C, ${description}</p>
    </div>
  `;
}

// Load weather and stations when the page loads
window.onload = () => {
  loadStations();
  fetchWeather();
};