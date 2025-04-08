// Initialize prediction dropdown with station names
function initPredictionDropdown() {
    console.log("Initializing prediction dropdown");
    const predictionDropdown = document.getElementById("predictionStationSelect");
    const stationSelect = document.getElementById("stationSelect");
    
    if (!predictionDropdown || !stationSelect) {
        console.error("Prediction dropdown or station select not found");
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
    
    console.log("Prediction dropdown initialized");
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
    console.log("Predict button clicked");
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
    
    //Log
    console.log(`/predict?date=${date}&time=${formattedTime}&station_id=${station_id}`);

    // Send GET request to Flask API
    fetch(`/predict?date=${date}&time=${formattedTime}&station_id=${station_id}`, {
        method: "GET"
    })
        .then(response => {
            console.log("Raw response:", response);
            return response.json()})
        .then(data => {
            console.log("Prediction response:", data);
            if (data.predicted_available_bikes !== undefined) {
                resultDiv.innerHTML = `Predicted Available Bikes: ${Math.round(data.predicted_available_bikes)}`;
            } else {
                resultDiv.innerHTML = `Error: ${data.error || "Something went wrong"}`;
            }
        })
        .catch(error => {
            console.error("Fetch error:", error);
            resultDiv.innerHTML = `Error: ${error.message}`;
        });
}