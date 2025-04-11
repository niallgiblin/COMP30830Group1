// Charts module for displaying station usage data
const ChartsModule = (function() {
  // Chart instances
  let usageChart = null;
  let standsChart = null;
  let currentStationId = null;
  
  // Data cache
  const dataCache = new Map();
  const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes cache expiry
  
  // Initialize charts
  function initCharts() {
    const usageCanvas = document.getElementById("usageChart");
    const standsCanvas = document.getElementById("busyTimesChart");
    
    if (!usageCanvas || !standsCanvas) return;
    
    // Create placeholder charts
    createUsageChart(usageCanvas, {
      labels: [],
      values: []
    });
    createStandsChart(standsCanvas, {
      labels: [],
      values: []
    });
  }

  // Show loading state
  function showLoadingState() {
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
  }

  // Create usage pattern chart
  function createUsageChart(canvas, data) {
    if (usageChart) {
      usageChart.destroy();
      usageChart = null;
    }

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
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          spanGaps: true // Enable spanning gaps between points
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
          padding: {
            left: 10,
            right: 10,
            top: 10,
            bottom: 20
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
            type: 'category',
            title: {
              display: true,
              text: 'Time',
              font: {
                size: 14,
                weight: 'bold'
              },
              padding: {top: 10}
            },
            ticks: {
              font: {
                size: 12
              },
              padding: 5,
              maxRotation: 45,
              autoSkip: false,
              callback: function(value, index) {
                const targetHours = [5, 9, 12, 16, 19, 23];
                const hour = index + 5;
                return targetHours.includes(hour) ? `${hour.toString().padStart(2, '0')}:00` : '';
              }
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
    if (standsChart) {
      standsChart.destroy();
      standsChart = null;
    }

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
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
          padding: {
            left: 10,
            right: 10,
            top: 10,
            bottom: 20
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
            type: 'category',
            title: {
              display: true,
              text: 'Time',
              font: {
                size: 14,
                weight: 'bold'
              },
              padding: {top: 10}
            },
            ticks: {
              font: {
                size: 12
              },
              padding: 5,
              maxRotation: 45,
              autoSkip: false,
              callback: function(value, index) {
                const targetHours = [5, 9, 12, 16, 19, 23];
                const hour = index + 5;
                return targetHours.includes(hour) ? `${hour.toString().padStart(2, '0')}:00` : '';
              }
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  // Get cached data if available and not expired
  function getCachedData(stationId) {
    const cached = dataCache.get(stationId);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
      return cached.data;
    }
    return null;
  }

  // Update cache with new data
  function updateCache(stationId, data) {
    dataCache.set(stationId, {
      data: data,
      timestamp: Date.now()
    });
  }

  // Fetch station data
  function fetchStationData(stationId) {
    const cachedData = getCachedData(stationId);
    
    // If we have valid cached data, use it immediately
    if (cachedData) {
      updateChartsWithData(stationId, cachedData);
      return;
    }
    
    // Show loading state while fetching
    showLoadingState();
    
    // Fetch fresh data
    fetch(`/api/station/${stationId}/history`)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('No prediction data received');
        }
        
        // Update cache with fresh data
        updateCache(stationId, data);
        
        // Update the charts
        updateChartsWithData(stationId, data);
      })
      .catch(() => {
        // Show error state without logging
        const usageCanvas = document.getElementById("usageChart");
        const standsCanvas = document.getElementById("busyTimesChart");
        
        if (usageCanvas) {
          createUsageChart(usageCanvas, {
            labels: ['Error loading data'],
            values: [0]
          });
        }
        
        if (standsCanvas) {
          createStandsChart(standsCanvas, {
            labels: ['Error loading data'],
            values: [0]
          });
        }
      });
  }

  // Update charts with data
  function updateChartsWithData(stationId, data) {
    const usageCanvas = document.getElementById("usageChart");
    const standsCanvas = document.getElementById("busyTimesChart");
    
    if (!usageCanvas || !standsCanvas) return;
    
    // Generate all time slots from 05:00 to 23:00
    const allTimeSlots = [];
    for (let hour = 5; hour <= 23; hour++) {
        allTimeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    
    // Create a map of hours to predictions
    const predictionMap = new Map();
    data.forEach(prediction => {
        const hour = prediction.timestamp.split(':')[0];
        predictionMap.set(hour, prediction);
    });
    
    // Generate values for each hour
    const bikeValues = allTimeSlots.map(timeSlot => {
        const hour = timeSlot.split(':')[0];
        return predictionMap.get(hour)?.available_bikes ?? null;
    });
    
    const standValues = allTimeSlots.map(timeSlot => {
        const hour = timeSlot.split(':')[0];
        return predictionMap.get(hour)?.available_stands ?? null;
    });
    
    // Update charts
    if (usageCanvas) {
        createUsageChart(usageCanvas, {
            labels: allTimeSlots,
            values: bikeValues
        });
    }
    
    if (standsCanvas) {
        createStandsChart(standsCanvas, {
            labels: allTimeSlots,
            values: standValues
        });
    }
  }
  
  // Debounce function to prevent multiple rapid requests
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // Update charts with station data
  const updateCharts = debounce(function(stationId) {
    currentStationId = stationId;
    fetchStationData(stationId);
  }, 300);
  
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