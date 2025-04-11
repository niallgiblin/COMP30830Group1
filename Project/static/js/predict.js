// Initialize prediction dropdown with station names
function initPredictionDropdown() {
    const predictionDropdown = document.getElementById("predictionStationSelect");
    const stationSelect = document.getElementById("stationSelect");
    
    if (!predictionDropdown || !stationSelect) {
        return;
    }
    
    // Clear existing options except the first one
    while (predictionDropdown.options.length > 1) {
        predictionDropdown.remove(1);
    }
    
    // Clone the options from the main station select dropdown, skipping the first "Select a station" option
    const options = stationSelect.options;
    for (let i = 1; i < options.length; i++) {
        const option = options[i].cloneNode(true);
        predictionDropdown.appendChild(option);
    }
    
    // Setup search functionality for prediction dropdown
    setupPredictionStationSearch();
}

// Setup search functionality for prediction dropdown
function setupPredictionStationSearch() {
    const searchInput = document.getElementById("predictionStationSearch");
    const dropdown = document.getElementById("predictionStationSelect");

    if (!searchInput || !dropdown) {
        return;
    }

    searchInput.addEventListener("input", function () {
        const searchTerm = this.value.toLowerCase();
        const options = dropdown.options;

        // First option is "Select a station"
        for (let i = 1; i < options.length; i++) {
            const stationName = options[i].textContent.toLowerCase();
            options[i].style.display = stationName.includes(searchTerm)
                ? ""
                : "none";
        }

        // If dropdown is closed, open it when typing
        if (searchTerm.length > 0 && !dropdown.multiple) {
            dropdown.size = Math.min(10, options.length);
            dropdown.style.overflowY = "auto";
        } else {
            dropdown.size = 1;
            dropdown.style.overflowY = "";
        }
    });

    // Close the dropdown when clicking elsewhere
    document.addEventListener("click", function (e) {
        if (e.target !== searchInput && e.target !== dropdown) {
            dropdown.size = 1;
        }
    });

    // Add keyboard navigation
    searchInput.addEventListener("keydown", function (e) {
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

// Call this function when the page loads
document.addEventListener("DOMContentLoaded", function() {
    // Wait for stations to be loaded before initializing the dropdown
    const checkStationsLoaded = setInterval(function() {
        if (window.StationsModule && window.StationsModule.getStationData && window.StationsModule.getStationData().length > 0) {
            clearInterval(checkStationsLoaded);
            initPredictionDropdown();
        }
    }, 100);
});

function predict() {
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;
    const stationSelect = document.getElementById("predictionStationSelect");
    const station_id = stationSelect.value;
    const resultDiv = document.getElementById("result");
  
    // Validate input
    if (!date || !time || !station_id) {
        resultDiv.innerHTML = "Please select date, time, and station.";
        return;
    }

    // Format time to HH:MM:SS
    const formattedTime = `${time}:00`;
    
    // Send GET request to Flask API
    fetch(`/predict?date=${date}&time=${formattedTime}&station_id=${station_id}`, {
        method: "GET"
    })
        .then(response => {
            return response.json()})
        .then(data => {
            if (data.predicted_available_bikes !== undefined) {
                resultDiv.innerHTML = `Predicted Available Bikes: ${Math.round(data.predicted_available_bikes)}`;
            } else {
                resultDiv.innerHTML = `Error: ${data.error || "Something went wrong"}`;
            }
        })
        .catch(error => {
            resultDiv.innerHTML = `Error: ${error.message}`;
        });
}