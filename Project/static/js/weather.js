const WeatherModule = (function () {
  // Configuration
  const STORAGE_KEY = "dublin_weather_data";

  // Initialize weather - fetch only once on page load
  function init() {
    fetchWeather();
    return true;
  }

  // Fetch weather data only when necessary
  async function fetchWeather() {
    try {
      // Try to use cached data from localStorage first
      const cachedData = getStoredWeatherData();
      if (cachedData) {
        console.log("Using cached weather data from localStorage");
        displayWeather(cachedData);
        return cachedData;
      }

      // Only fetch from server endpoint if no cache exists
      console.log("Fetching fresh weather data from server");

      // Endpoint URL - calling our server endpoint
      const response = await fetch("/api/weather");

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();

      // Store in localStorage with timestamp
      storeWeatherData(data);

      // Update UI
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

  // Get stored weather data from localStorage
  function getStoredWeatherData() {
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (!storedData) return null;

      const weatherData = JSON.parse(storedData);
      const timestamp = weatherData.timestamp || 0;

      // If data is from today, use it - only fetch new data once per day
      const today = new Date().toDateString();
      const storedDate = new Date(timestamp).toDateString();

      if (today === storedDate) {
        return weatherData.data;
      }

      return null;
    } catch (e) {
      console.warn("Error reading from localStorage:", e);
      return null;
    }
  }

  // Store weather data in localStorage
  function storeWeatherData(data) {
    try {
      const weatherData = {
        timestamp: Date.now(),
        data: data,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(weatherData));
    } catch (e) {
      console.warn("Error saving to localStorage:", e);
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

  // Remove the DOMContentLoaded listener at bottom
  // Keep just this:
  return {
    fetch: fetchWeather,
  };
})();

window.WeatherModule = WeatherModule;