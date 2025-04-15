// Charts module for displaying station usage data
const ChartsModule = (function() {
  // Chart instances
  let usageChart = null;
  let standsChart = null;
  
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

  // Format time for display
  function formatTimeLabel(value) {
    if (typeof value !== 'string') return value;
    // Remove :00 only if it exists at the end of the string
    return value.endsWith(':00') ? value.slice(0, -3) : value;
  }

  // Safely destroy a chart instance
  function safelyDestroyChart(chart) {
    if (chart) {
      chart.destroy();
      return null;
    }
    return null;
  }

  // Create usage pattern chart
  function createUsageChart(canvas, data) {
    // Safely destroy existing chart
    usageChart = safelyDestroyChart(usageChart);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    usageChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.labels || [],
        datasets: [{
          label: 'Typical Available Bikes',
          data: data.values || [],
          borderColor: '#4285F4',
          backgroundColor: 'rgba(66, 133, 244, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 750,
          easing: 'easeInOutQuart'
        },
        layout: {
          padding: {
            left: 10,
            right: 25,
            top: 20,
            bottom: 20
          }
        },
        plugins: {
          title: {
            display: false
          },
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
                const value = context.raw;
                if (value === null || value === undefined) {
                  return 'No data available';
                }
                return `Typically Available Bikes: ${Math.round(value)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            min: 0,
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
              drawBorder: false,
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            type: 'category',
            title: {
              display: true,
              text: 'Time of Day',
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
              maxRotation: 45,
              minRotation: 45,
              callback: function(value) {
                return formatTimeLabel(value);
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
    // Safely destroy existing chart
    standsChart = safelyDestroyChart(standsChart);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    standsChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.labels || [],
        datasets: [{
          label: 'Typical Available Stands',
          data: data.values || [],
          borderColor: '#34A853',
          backgroundColor: 'rgba(52, 168, 83, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 750,
          easing: 'easeInOutQuart'
        },
        layout: {
          padding: {
            left: 10,
            right: 25,
            top: 20,
            bottom: 20
          }
        },
        plugins: {
          title: {
            display: false
          },
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
                const value = context.raw;
                if (value === null || value === undefined) {
                  return 'No data available';
                }
                return `Typically Available Stands: ${Math.round(value)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            min: 0,
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
              drawBorder: false,
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            type: 'category',
            title: {
              display: true,
              text: 'Time of Day',
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
              maxRotation: 45,
              minRotation: 45,
              callback: function(value) {
                return formatTimeLabel(value);
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

  // Update charts with data
  function updateChartsWithData(data) {
    const usageCanvas = document.getElementById("usageChart");
    const standsCanvas = document.getElementById("busyTimesChart");
    
    if (!usageCanvas || !standsCanvas) return;
    
    // Ensure data is valid
    if (!Array.isArray(data) || data.length === 0) {
      console.error("Invalid or empty data received");
      createUsageChart(usageCanvas, {
        labels: ["No data available"],
        values: [0],
      });
      createStandsChart(standsCanvas, {
        labels: ["No data available"],
        values: [0],
      });
      return;
    }
    
    // Extract and validate data from the response
    const validData = data.filter(
      (point) =>
        point &&
        point.timestamp !== undefined &&
        point.available_bikes !== undefined &&
        point.available_stands !== undefined
    );
    
    // Ensure we have data points
    if (validData.length === 0) {
      console.error("No valid data points found");
      createUsageChart(usageCanvas, {
        labels: ["No valid data"],
        values: [0],
      });
      createStandsChart(standsCanvas, {
        labels: ["No valid data"],
        values: [0],
      });
      return;
    }
    
    // Sort data by timestamp to ensure correct order
    validData.sort((a, b) => {
      const timeA = parseInt(a.timestamp.split(":")[0]);
      const timeB = parseInt(b.timestamp.split(":")[0]);
      return timeA - timeB;
    });
    
    const timeSlots = validData.map((point) => point.timestamp);
    const bikeValues = validData.map((point) => point.available_bikes === null ? 0 : point.available_bikes);
    const standValues = validData.map((point) => point.available_stands === null ? 0 : point.available_stands);
    
    // Update charts
    createUsageChart(usageCanvas, {
      labels: timeSlots,
      values: bikeValues,
    });
    
    createStandsChart(standsCanvas, {
      labels: timeSlots,
      values: standValues,
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
      updateChartsWithData(cachedData);
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
        if (!Array.isArray(data)) {
          throw new Error('Invalid data format received');
        }
        
        // Update cache with fresh data
        updateCache(stationId, data);
        
        // Update the charts
        updateChartsWithData(data);
      })
      .catch(() => {
        // Show error state without logging
        const usageCanvas = document.getElementById("usageChart");
        const standsCanvas = document.getElementById("busyTimesChart");
        
        if (usageCanvas) {
          createUsageChart(usageCanvas, {
            labels: ["Error loading data"],
            values: [0],
          });
        }
        
        if (standsCanvas) {
          createStandsChart(standsCanvas, {
            labels: ["Error loading data"],
            values: [0],
          });
        }
      });
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