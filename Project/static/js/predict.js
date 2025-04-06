function predict() {
    console.log("Predict button clicked");
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;
    const station_id = document.getElementById("station_id").value;
    const resultDiv = document.getElementById("result");
  
    // Validate input
    if (!date || !time || !station_id) {
        resultDiv.innerHTML = "Please select date time and station.";
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