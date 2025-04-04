// main.js
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, waiting for Google Maps...");

  // Initialize when Google Maps is loaded
  window.initMap = async function () {
    try {
      console.log("Google Maps loaded, initializing application...");

      // Initialize the map first
      const map = MapModule.init();
      if (!map) {
        throw new Error("Failed to initialize map");
      }
      console.log("Map initialized");

      // Initialize UI module
      if (UIModule && UIModule.init) {
        UIModule.init();
        console.log("UI module initialized");
      }

      // Initialize directions module
      if (DirectionsModule && DirectionsModule.init) {
        DirectionsModule.init();
        console.log("Directions module initialized");
      }

      // Load stations data
      await StationsModule.loadStations();
      console.log("Stations loaded");

      // Fetch weather data
      if (WeatherModule && WeatherModule.fetch) {
        WeatherModule.fetch().catch((error) => {
          console.warn("Weather data could not be loaded:", error);
        });
      }

      // Initialize the reset button as hidden
      const resetBtn = document.getElementById("resetBtn");
      if (resetBtn) {
        resetBtn.style.display = "none";
      }

      console.log("Application initialization complete");
    } catch (error) {
      console.error("Initialization error:", error);
      alert(
        "Failed to initialize the application. Please try refreshing the page."
      );
    }
  };
    const findBikeBtn = document.getElementById("findNearestBikeBtn");
    if (findBikeBtn) {
      findBikeBtn.addEventListener("click", function () {
        console.log("Find Bike button clicked");
        StationsModule.findNearestAvailableBike();
      });
    } else {
      console.error("Find Bike button not found in the DOM!");
  }
});