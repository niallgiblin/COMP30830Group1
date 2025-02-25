let stationData = []; // Store JSON data globally

// Load station data from JSON
function loadStations() {
    fetch("static/datafortesting.json")  // Ensure the JSON file exists in /static/
        .then(response => response.json())
        .then(data => {
            stationData = data; // Store globally
            populateDropdown(data);
        })
        .catch(error => console.error("Error loading stations:", error));
}

// Populate the dropdown menu with station names
function populateDropdown(stations) {
    let dropdown = document.getElementById("stationSelect");
    stations.forEach(station => {
        let option = document.createElement("option");
        option.value = station.number; // Use station number as value
        option.textContent = station.name;
        dropdown.appendChild(option);
    });

    // Add event listener for dropdown selection
    dropdown.addEventListener("change", function() {
        let selectedStation = stationData.find(s => s.number == this.value);
        if (selectedStation) {
            showStationInfo(selectedStation);
        }
    });
}

// Show station information when selected from the dropdown
function showStationInfo(station) {
    document.getElementById("stationName").textContent = station.name;
    document.getElementById("availableBikes").textContent = station.available_bikes;
    document.getElementById("freeStands").textContent = station.available_bike_stands;
    document.getElementById("stationStatus").textContent = station.status;
}

// Load stations when the page loads
window.onload = loadStations;
