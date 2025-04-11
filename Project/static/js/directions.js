// Directions handling module
const DirectionsModule = (function () {
  // Initialize directions UI
  function initDirectionsUI() {
    document
      .getElementById("close-directions")
      .addEventListener("click", () => {
        document.getElementById("directions-panel").style.display = "none";
        // Notify map module to clear directions
        if (window.MapModule && window.MapModule.clearDirections) {
          window.MapModule.clearDirections();
        }
      });
  }

  // Display step by step directions in the UI
  function displayStepByStepDirections(response) {
    const panel = document.getElementById("directions-steps");
    panel.innerHTML = "";

    document.getElementById("directions-panel").style.display = "block";

    const route = response.routes[0];
    const leg = route.legs[0];

    // Add route summary
    const summary = document.createElement("div");
    summary.className = "route-summary";
    summary.innerHTML = `
      <strong>🚲 ${leg.distance.text} walk</strong><br>
      <em>About ${leg.duration.text}</em>
    `;
    panel.appendChild(summary);

    // Add each step
    leg.steps.forEach((step) => {
      const stepElement = document.createElement("div");
      stepElement.className = "direction-step";

      // Get appropriate icon
      const icon = getDirectionIcon(step.maneuver || "");

      stepElement.innerHTML = `
        <div class="step-icon">${icon}</div>
        <div class="step-content">
          ${stripHtml(step.instructions)}
          <div class="step-distance">${step.distance.text}</div>
        </div>
      `;

      panel.appendChild(stepElement);
    });
  }

  // Get icon for direction step
  function getDirectionIcon(maneuver) {
    if (maneuver.includes("left")) return "↰";
    if (maneuver.includes("right")) return "↱";
    if (maneuver.includes("straight")) return "↑";
    if (maneuver.includes("uturn")) return "↶";
    return "•";
  }

  // Strip HTML from text
  function stripHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  }

  // Public API
  return {
    init: initDirectionsUI,
    displayStepByStepDirections,
  };
})();

// Make DirectionsModule available globally
window.DirectionsModule = DirectionsModule;