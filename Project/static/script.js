let stationData = []; // Store JSON data globally
let map; // Store the map object globally
let markers = []; // Store markers for later reference
let currentInfoWindow = null; // Store the current info window

// Load station data from JSON
function loadStations() {
  fetch("/stations") // Fetch station data from your Flask endpoint
    .then((response) => response.json())
    .then((data) => {
      console.log("Fetched station data:", data); // Debugging
      stationData = data.stations; // Store globally
      populateDropdown(data.stations);
      addMarkersToMap(data.stations); // Add markers to the map
    })
    .catch((error) => console.error("Error loading stations:", error));
}

// Populate the dropdown menu with station names
function populateDropdown(stations) {
  let dropdown = document.getElementById("stationSelect");
  stations.forEach((station) => {
    let option = document.createElement("option");
    option.value = station.number; // Use station number as value
    option.textContent = station.name;
    dropdown.appendChild(option);
  });

  // Add event listener for dropdown selection
  dropdown.addEventListener("change", function () {
    let selectedStation = stationData.find((s) => s.number == this.value);
    if (selectedStation) {
      showStationInfo(selectedStation);
      centerMapOnStation(selectedStation); // Center the map on the selected station
      fetchAvailability(selectedStation.number); // Fetch availability data
    }
  });
}

// Show station information when selected from the dropdown
function showStationInfo(station) {
  document.getElementById("stationName").textContent = station.name;
  document.getElementById("stationStatus").textContent = station.status;
  // Clear availability data until fetchAvailability updates it
  document.getElementById("availableBikes").textContent = "Loading...";
  document.getElementById("freeStands").textContent = "Loading...";
}

// Fetch availability data for a specific station
// function fetchAvailability(station_id) {
//   fetch(`/available/${station_id}`)
//     .then((response) => response.json())
//     .then((data) => {
//       console.log("Fetched availability data:", data); // Debugging
//       if (data.available.length > 0) {
//         const availability = data.available[0];
//         document.getElementById("availableBikes").textContent =
//           availability.available_bikes || "N/A";
//         document.getElementById("freeStands").textContent =
//           availability.available_bike_stands || "N/A";
//       } else {
//         document.getElementById("availableBikes").textContent = "N/A";
//         document.getElementById("freeStands").textContent = "N/A";
//       }
//     })
//     .catch((error) => console.error("Error fetching availability:", error));
// }

// Center the map on a specific station
function centerMapOnStation(station) {
  const stationLocation = {
    lat: parseFloat(station.position_lat),
    lng: parseFloat(station.position_lng),
  };
  map.setCenter(stationLocation);
  map.setZoom(15); // Zoom in for better visibility
}

// Initialize and add the map
function initMap() {
  const dublin = { lat: 53.35014, lng: -6.266155 };
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: dublin,
    mapId: "YOUR_MAP_ID", // Optional: Add a map ID for styling
  });
//   console.log("Map initialized:", map); // Debugging
}

// Add markers for all stations using classic Marker
function addMarkersToMap(stations) {
  console.log("Adding markers for stations:", stations); // Debugging
  stations.forEach((station) => {
    const lat = parseFloat(station.position_lat); // Use position_lat
    const lng = parseFloat(station.position_lng); // Use position_lng

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

    // Add a click listener to the marker to show the info window
    marker.addListener("click", () => {
      // Close the current info window if it exists
      if (currentInfoWindow) {
        currentInfoWindow.close();
      }
      // Fetch availability data dynamically
      fetchAvailability(station.number).then((availability) => {
        const infoWindow = new google.maps.InfoWindow({
          content: `
                        <div>
                            <h3>${station.name}</h3>
                            <p><strong>Address:</strong> ${
                              station.address || "N/A"
                            }</p>
                            <p><strong>Available Bikes:</strong> ${
                              availability.available_bikes || "N/A"
                            }</p>
                            <p><strong>Free Stands:</strong> ${
                              availability.available_bike_stands || "N/A"
                            }</p>
                        </div>
                    `,
        });
        infoWindow.open(map, marker);
        // Update the current info window
        currentInfoWindow = infoWindow;
      });
    });

    markers.push(marker); // Store the marker for later reference
  });
}

// Fetch availability data for a specific station
function fetchAvailability(station_id) {
  return fetch(`/available/${station_id}`)
    .then((response) => response.json())
    .then((data) => {
      console.log("Fetched availability data:", data); // Debugging
      if (data.available.length > 0) {
        return data.available[0]; // Return the first availability record
      } else {
        return { available_bikes: "N/A", available_bike_stands: "N/A" };
      }
    })
    .catch((error) => {
      console.error("Error fetching availability:", error);
      return { available_bikes: "N/A", available_bike_stands: "N/A" };
    });
}

// Load stations when the page loads
window.onload = loadStations;