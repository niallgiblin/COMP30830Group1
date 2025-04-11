// main.js
document.addEventListener("DOMContentLoaded", function () {
  // Define initMap function immediately to ensure it's available when Google Maps calls it
  window.initMap = async function () {
    try {
      // Check if required modules are available
      if (!window.MapModule) {
        console.error("MapModule not loaded");
        throw new Error("MapModule not loaded");
      }

      // Initialize the map first
      const map = MapModule.init();
      if (!map) {
        throw new Error("Failed to initialize map");
      }

      // Initialize UI module
      if (UIModule && UIModule.init) {
        UIModule.init();
      }

      // Initialize directions module
      if (DirectionsModule && DirectionsModule.init) {
        DirectionsModule.init();
      } else {
        console.warn("DirectionsModule not available");
      }

      // Load stations data
      if (window.StationsModule && window.StationsModule.loadStations) {
        await StationsModule.loadStations();
        
        // Initialize prediction dropdown after stations are loaded
        if (typeof initPredictionDropdown === 'function') {
          initPredictionDropdown();
        }
      } else {
        console.error("StationsModule not loaded");
      }

      // Fetch weather data
      if (WeatherModule && WeatherModule.fetch) {
        WeatherModule.fetch().catch((error) => {
          console.warn("Weather data could not be loaded:", error);
        });
      }

      // Initialize the find bike button
      const findBikeBtn = document.getElementById("findNearestBikeBtn");
      if (findBikeBtn) {
        findBikeBtn.addEventListener("click", function () {
          if (window.StationsModule && window.StationsModule.findNearestAvailableBike) {
            // Use requestAnimationFrame to avoid blocking the main thread
            requestAnimationFrame(() => {
              StationsModule.findNearestAvailableBike();
            });
          }
        });
      }
    } catch (error) {
      console.error("Initialization error:", error);
      alert("Failed to initialize the application. Please try refreshing the page.");
    }
  };
  
  // Add a fallback in case Google Maps doesn't load
  setTimeout(function() {
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
      console.error("Google Maps failed to load");
      alert("Google Maps failed to load. Please check your internet connection and refresh the page.");
    }
  }, 10000); // 10 second timeout
});