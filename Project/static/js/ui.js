// UI interactions module
const UIModule = (function () {
  // Populate the dropdown menu with stations
  function populateDropdown(stations) {
    const uniqueStations = [
      ...new Map(stations.map((station) => [station.number, station])).values(),
    ];
    const sortedStations = uniqueStations.sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    let dropdown = document.getElementById("stationSelect");
    if (!dropdown) {
      console.error("Station select dropdown not found");
      return;
    }

    dropdown.innerHTML = "<option value=''>Select a station</option>";

    sortedStations.forEach((station) => {
      let option = document.createElement("option");
      option.value = station.number;
      option.textContent = station.name;
      dropdown.appendChild(option);
    });

    // Add event listener for dropdown selection
    dropdown.addEventListener("change", function () {
      if (!this.value) return;

      const stationData = window.StationsModule.getStationData();
      const selectedStation = stationData.find((s) => s.number == this.value);

      if (selectedStation) {
        showStationInfo(selectedStation);
        if (window.MapModule) {
          window.MapModule.centerOnStation(selectedStation);
        }
        showResetButton();
      }
    });
  }

  // Setup station search functionality
  function setupStationSearch() {
    const searchInput = document.getElementById("stationSearch");
    const dropdown = document.getElementById("stationSelect");

    if (!searchInput || !dropdown) {
      console.error("Search input or dropdown not found");
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

  // Show station information
  async function showStationInfo(station) {
    const stationNameElement = document.getElementById("stationName");
    const stationStatusElement = document.getElementById("stationStatus");
    const availableBikesElement = document.getElementById("availableBikes");
    const freeStandsElement = document.getElementById("freeStands");
    const stationInfoElement = document.getElementById("stationInfo");

    if (
      !stationNameElement ||
      !stationStatusElement ||
      !availableBikesElement ||
      !freeStandsElement ||
      !stationInfoElement
    ) {
      console.error("Station info elements not found");
      return;
    }

    stationNameElement.textContent = station.name;
    stationStatusElement.textContent = station.status;

    // Use cached data if available
    if (window.StationsModule) {
      const cache = window.StationsModule.getCache();
      if (cache[station.number]) {
        const availability = cache[station.number].data;
        availableBikesElement.textContent = availability.available_bikes;
        freeStandsElement.textContent = availability.available_bike_stands;
      } else {
        // API call if no cache
        const availability = await window.StationsModule.fetchAvailability(
          station.number
        );
        availableBikesElement.textContent = availability.available_bikes;
        freeStandsElement.textContent = availability.available_bike_stands;
      }
    }

    stationInfoElement.style.display = "block";
  }

  // Toggle reset button visibility
  function toggleResetButton(show) {
    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
      resetBtn.style.display = show ? "block" : "none";
    }
  }

  // Show reset button
  function showResetButton() {
    toggleResetButton(true);
  }

  // Hide reset button
  function hideResetButton() {
    toggleResetButton(false);
  }

  // Show alert message
  function showAlert(message) {
    alert(message);
  }

  // Show error message
  function showError(message) {
    console.error(message);
    showAlert(message);
  }

  // Set up event listeners
  function initializeEventListeners() {
    console.log("Initializing UI event listeners");
    
    // Show reset button when finding nearest bike or selecting a station
    const findBikeBtn = document.getElementById("findNearestBikeBtn");
    if (findBikeBtn) {
      findBikeBtn.addEventListener("click", showResetButton);
    }

    const stationSelect = document.getElementById("stationSelect");
    if (stationSelect) {
      stationSelect.addEventListener("change", function () {
        if (this.value) showResetButton();
      });
    }

    // Reset button click handler
    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (window.MapModule) window.MapModule.resetView();
        hideResetButton();
      });
    }

    // Set MapModule marker click callback if available
    if (window.MapModule && window.MapModule.setOnMarkerClick) {
      window.MapModule.setOnMarkerClick(showResetButton);
    }
  }

  // Public API
  return {
    populateDropdown,
    setupStationSearch,
    showStationInfo,
    toggleResetButton,
    showResetButton,
    hideResetButton,
    showAlert,
    showError,
    init: initializeEventListeners,
  };
})();

window.UIModule = UIModule;