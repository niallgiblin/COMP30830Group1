// Utility functions module
const UtilsModule = (function () {
  // Calculate distance between two coordinates using Haversine formula
  function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * 
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

  // Get user's current location
  function getUserLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        // Verify coordinates are valid
        if (isNaN(position.coords.latitude)) {
          reject(new Error("Invalid coordinates"));
          return;
        }
        resolve(position);
      },
      error => {
        reject(new Error(
          error.code === error.TIMEOUT ? 
          "Location request timed out" : 
          "Please enable location services"
        ));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        ...options
      }
    );
  });
}

  // Format timestamp to human readable date
  function formatTimestamp(timestamp) {
    if (!timestamp) return "Unknown";
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  // Public API
  return {
    calculateDistance,
    getUserLocation,
    formatTimestamp,
  };
})();

window.UtilsModule = UtilsModule;