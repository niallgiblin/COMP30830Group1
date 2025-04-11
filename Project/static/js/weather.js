const WeatherModule = (function () {
  // Configuration
  const REFRESH_INTERVAL = 300000; // Refresh every 5 minutes
  let updateInterval = null;

  // Initialize weather
  function init() {
    fetchWeather();
    // Set up regular updates
    updateInterval = setInterval(fetchWeather, REFRESH_INTERVAL);
    return true;
  }

  // Fetch fresh weather data
  async function fetchWeather() {
    try {
      // Add timestamp to prevent caching
      const timestamp = Date.now();
      const response = await fetch(`/api/weather?_=${timestamp}`);

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      displayWeather(data);
      return data;
    } catch (error) {
      console.error("Error fetching weather:", error);
      document.getElementById(
        "weather"
      ).innerHTML = `<div class="weather-card"><p>Weather data unavailable</p></div>`;
      return null;
    }
  }

  // Display weather data in the UI
  function displayWeather(weather) {
    try {
      const weatherDiv = document.getElementById("weather");
      if (!weatherDiv) {
        console.warn("Weather div not found");
        return;
      }

      if (!weather?.main) {
        weatherDiv.innerHTML = `
          <div class="weather-card">
            <p>Weather data loading...</p>
          </div>
        `;
        return;
      }

      const temp = weather.main.temp?.toFixed(1) ?? "N/A";
      const desc = weather.weather?.[0]?.description ?? "check back later";
      const icon = weather.weather?.[0]?.icon ?? "50d";

      weatherDiv.innerHTML = `
        <div class="weather-card">
          <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}">
          <p>${temp}°C, ${desc}</p>
        </div>
      `;
    } catch (e) {
      console.error("Weather display error:", e);
    }
  }

  // Clean up interval on page unload
  window.addEventListener('unload', () => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });

  return {
    init: init,
    fetch: fetchWeather
  };
})();

// Make WeatherModule available globally
window.WeatherModule = WeatherModule;

// Initialize weather module when the page loads
document.addEventListener("DOMContentLoaded", () => {
  WeatherModule.init();
});