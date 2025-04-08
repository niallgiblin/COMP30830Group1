// Charts module for displaying station usage data
const ChartsModule = (function() {
  // Chart instances
  let usageChart = null;
  let standsChart = null;
  
  // Initialize charts
  function initCharts() {
    console.log("Initializing charts");
    
    // Get chart canvases
    const usageCanvas = document.getElementById("usageChart");
    const standsCanvas = document.getElementById("busyTimesChart");
    
    if (!usageCanvas || !standsCanvas) {
      console.error("Chart canvases not found");
      return;
    }
    
    // Create placeholder charts
    createUsageChart(usageCanvas, {
      labels: [],
      values: []
    });
    createStandsChart(standsCanvas, {
      labels: [],
      values: []
    });
    
    console.log("Charts initialized");
  }
  
  // Create usage pattern chart
  function createUsageChart(canvas, data) {
    // Destroy existing chart if it exists
    if (usageChart) {
      usageChart.destroy();
    }
    
    // Create new chart
    usageChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.labels || [],
        datasets: [{
          label: 'Available Bikes',
          data: data.values || [],
          borderColor: '#4285F4',
          backgroundColor: 'rgba(66, 133, 244, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            left: 10,
            right: 10,
            top: 10,
            bottom: 10
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            titleFont: {
              size: 14
            },
            bodyFont: {
              size: 14
            },
            padding: 10,
            callbacks: {
              label: function(context) {
                return `Available Bikes: ${Math.round(context.raw)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Available Bikes',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              font: {
                size: 12
              },
              padding: 5,
              callback: function(value) {
                return Math.round(value);
              },
              stepSize: 5
            },
            grid: {
              drawBorder: false
            }
          },
          x: {
            title: {
              display: false
            },
            ticks: {
              font: {
                size: 12
              },
              padding: 5,
              maxRotation: 0
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
  
  // Create stands availability chart
  function createStandsChart(canvas, data) {
    // Destroy existing chart if it exists
    if (standsChart) {
      standsChart.destroy();
    }
    
    // Create new chart
    standsChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.labels || [],
        datasets: [{
          label: 'Available Stands',
          data: data.values || [],
          borderColor: '#34A853',
          backgroundColor: 'rgba(52, 168, 83, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            left: 10,
            right: 10,
            top: 10,
            bottom: 10
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            titleFont: {
              size: 14
            },
            bodyFont: {
              size: 14
            },
            padding: 10,
            callbacks: {
              label: function(context) {
                return `Available Stands: ${Math.round(context.raw)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Available Stands',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              font: {
                size: 12
              },
              padding: 5,
              callback: function(value) {
                return Math.round(value);
              },
              stepSize: 5
            },
            grid: {
              drawBorder: false
            }
          },
          x: {
            title: {
              display: false
            },
            ticks: {
              font: {
                size: 12
              },
              padding: 5,
              maxRotation: 0
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
  
  // Update charts with station data
  function updateCharts(stationId) {
    console.log(`Updating charts for station ${stationId}`);
    
    // Show loading state
    const usageCanvas = document.getElementById("usageChart");
    const standsCanvas = document.getElementById("busyTimesChart");
    
    if (usageCanvas) {
      createUsageChart(usageCanvas, {
        labels: ['Loading...'],
        values: [0]
      });
    }
    
    if (standsCanvas) {
      createStandsChart(standsCanvas, {
        labels: ['Loading...'],
        values: [0]
      });
    }
    
    // Fetch historical data for the station
    fetch(`/api/station_history/${stationId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        console.log("Received station history data:", data);
        
        if (!data.usagePattern) {
          throw new Error('No usage pattern data received');
        }
        
        // Update usage chart
        if (usageCanvas) {
          createUsageChart(usageCanvas, {
            labels: data.usagePattern.labels,
            values: data.usagePattern.available_bikes
          });
        }
        
        // Update stands chart
        if (standsCanvas) {
          createStandsChart(standsCanvas, {
            labels: data.usagePattern.labels,
            values: data.usagePattern.available_stands
          });
        }
      })
      .catch(error => {
        console.error("Error fetching station history:", error);
        
        // Create empty charts with placeholder data
        if (usageCanvas) {
          createUsageChart(usageCanvas, {
            labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
            values: [5, 3, 2, 8, 12, 15, 10, 7]
          });
        }
        
        if (standsCanvas) {
          createStandsChart(standsCanvas, {
            labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
            values: [15, 17, 18, 12, 8, 5, 10, 13]
          });
        }
      });
  }
  
  // Public API
  return {
    initCharts,
    updateCharts
  };
})();

// Make ChartsModule available globally
window.ChartsModule = ChartsModule;

// Initialize charts when the page loads
document.addEventListener("DOMContentLoaded", function() {
  window.ChartsModule.initCharts();
}); 