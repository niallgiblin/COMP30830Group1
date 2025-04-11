from flask import Flask, render_template, jsonify, request
import os
from dotenv import load_dotenv
import requests
from datetime import datetime, timezone
import pickle
import numpy as np
import json
import pandas as pd
import logging
from flask_caching import Cache
import mysql.connector
import gzip
from functools import lru_cache

# Configure logging for development
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Load the machine learning model
model_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'bike_availability_model.pkl')
try:
    if not os.path.exists(model_path):
        raise Exception("Model file not found")
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    if model is None:
        raise Exception("Model loaded but is None")
except Exception as e:
    logger.error(f"Error loading model: {str(e)}")
    model = None

# Load historical data
data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'final_data_for_ml.csv')
try:
    if not os.path.exists(data_path):
        raise Exception("Historical data file not found")
    historical_data = pd.read_csv(data_path)
    if historical_data is None or historical_data.empty:
        raise Exception("Historical data loaded but is empty")
except Exception as e:
    logger.error(f"Error loading historical data: {str(e)}")
    historical_data = None

# Create Flask app
app = Flask(__name__)
app.config['DEBUG'] = True
app.config['TESTING'] = False

# Add security headers
@app.after_request
def add_security_headers(response):
    # Basic security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Modern Permissions-Policy header (replaces Feature-Policy)
    response.headers['Permissions-Policy'] = (
        'accelerometer=(), '
        'camera=(), '
        'geolocation=(self), '  # Allow geolocation for the same origin
        'gyroscope=(), '
        'magnetometer=(), '
        'microphone=(), '
        'payment=(), '
        'usb=()'
    )
    
    return response

# Configuration from .env variables
app.config['GOOGLE_MAPS_API_KEY'] = os.environ.get('GOOGLE_MAPS_API_KEY')
app.config['DB_USER'] = os.environ.get('DB_USER')
app.config['DB_PASSWORD'] = os.environ.get('DB_PASSWORD')
app.config['DB_PORT'] = os.environ.get('DB_PORT', '3306')
app.config['DB_NAME'] = os.environ.get('DB_NAME')
app.config['DB_HOST'] = os.environ.get('DB_HOST', '127.0.0.1')

# Configure cache
cache = Cache(app, config={
    'CACHE_TYPE': 'simple',
    'CACHE_DEFAULT_TIMEOUT': 300
})

# Database configuration
db_config = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}

# Database connection with connection pooling
def get_db_connection():
    try:
        conn = mysql.connector.connect(
            pool_name="mypool",
            pool_size=5,
            **db_config
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        return None

# Initialize connection pool
get_db_connection()

# Cache for weather data
@lru_cache(maxsize=100)
def get_cached_weather(lat, lng):
    return fetch_weather_data(lat, lng)

# Cache for station data
@lru_cache(maxsize=100)
def get_cached_station(station_id):
    return fetch_station_data(station_id)

# Compress response data
def compress_response(data):
    return gzip.compress(jsonify(data).data)

# Home page route
@app.route('/')
def index():
    return render_template('index.html', google_maps_api_key=app.config['GOOGLE_MAPS_API_KEY'])

# API route to get all stations
@app.route('/stations')
@cache.cached(timeout=300)
def get_stations():
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM station")
        stations = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'stations': stations})
    except Exception:
        return jsonify({'error': 'Failed to fetch stations'}), 500
    
# API route to get availability for a specific station
@app.route("/available/<int:station_id>")
def get_station_availability(station_id):
    try:
        # Get live data from JCDecaux API
        api_key = os.environ.get('JCDECAUX_API_KEY')
        contract = "dublin"
        url = f"https://api.jcdecaux.com/vls/v1/stations/{station_id}?contract={contract}&apiKey={api_key}"
        
        response = requests.get(url)
        response.raise_for_status()
        station_data = response.json()
        
        return jsonify({
            "available_bikes": station_data['available_bikes'],
            "available_bike_stands": station_data['available_bike_stands'],
            "last_updated": datetime.fromtimestamp(station_data['last_update']/1000).isoformat()
        })
            
    except Exception as e:
        logger.error(f"Error fetching availability for station {station_id}: {str(e)}")
        return jsonify({
            "error": "API error",
            "available_bikes": 0,
            "available_bike_stands": 0,
            "last_updated": datetime.now().isoformat()
        }), 200

@app.route('/api/weather')
def get_weather():
    """Get current weather data for Dublin."""
    try:
        api_key = os.environ.get('OPENWEATHER_API_KEY')
        if not api_key:
            logger.error("OpenWeather API key not found")
            return jsonify({'error': 'Weather API configuration error'}), 500

        url = (
            "https://api.openweathermap.org/data/2.5/weather?"
            "lat=53.3498&lon=-6.2603&"
            f"appid={api_key}&"
            "units=metric&"
            "lang=en"
        )
        
        timestamp = int(datetime.now().timestamp())
        url = f"{url}&_={timestamp}"
        
        response = requests.get(url, headers={
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        })
        response.raise_for_status()
        
        data = response.json()
        return jsonify(data)
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            logger.error("Invalid OpenWeather API key")
            return jsonify({"error": "Invalid API key"}), 401
        elif e.response.status_code == 429:
            logger.error("OpenWeather API rate limit exceeded")
            return jsonify({"error": "API rate limit exceeded"}), 429
        else:
            logger.error(f"Weather API error: {str(e)}")
            return jsonify({"error": f"Weather API error: {str(e)}"}), e.response.status_code
    except Exception as e:
        logger.error(f"Weather API error: {str(e)}")
        return jsonify({"error": "Weather data unavailable"}), 500


### PREDICTION
def fetch_openweather_forecast(datetime):
    # Pulling 5-day weather forecast from openweather
    api_key = os.environ.get('OPENWEATHER_API_KEY')
    url = (f"https://api.openweathermap.org/data/2.5/forecast?q=Dublin&appid={api_key}&units=metric"
        )
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()

    try:
        target_dt = int(datetime.replace(tzinfo=timezone.utc).timestamp())
    except ValueError as ve:
        logger.error(f"Date/time parsing error: {ve}")
        return None

    # Find the closest forecast time
    closest = None
    smallest_diff = float("inf")

    for item in data.get("list", []):
        forecast_time = item["dt"]  # already a UNIX timestamp
        diff = abs(forecast_time - target_dt)
        if diff < smallest_diff:
            smallest_diff = diff
            closest = item

    if closest:
        return {
            "temperature": closest["main"]["temp"],
            "humidity": closest["main"]["humidity"],
            "pressure": closest["main"]["pressure"],
        }

    return None


# Define a route for predictions
@app.route("/predict", methods=["GET"])
def predict():
    try:
        # Get date and time from request
        date = request.args.get("date")
        time = request.args.get("time")
        station_id = request.args.get("station_id")
        
        # Check for missing parameters first
        if not date or not time or not station_id:
            return jsonify({"error": "Missing date, time, or station_id parameter"}), 400
        
        try:
            station_id = int(station_id)
            if station_id > 117:
                return jsonify({"error": f"Invalid station_id: {station_id}"}), 400
        except ValueError:
            return jsonify({"error": "station_id must be a number"}), 400

        try:
            dt = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M:%S")
            if dt < datetime.now():
                return jsonify({"error": f"Prediction only for future time"}), 400
        except ValueError:
            return jsonify({"error": "Invalid date or time format. Use YYYY-MM-DD HH:MM:SS"}), 400
            
        hour = dt.hour
        day_of_week = dt.weekday()
        station_hour = f"{str(station_id)}_{hour}"

        # Get weather forecast
        openweather_data = fetch_openweather_forecast(dt)
        if not openweather_data:
            return jsonify({"error": "Failed to fetch weather forecast"}), 500
            
        logger.info(f"Weather data: {json.dumps(openweather_data)}")

        # Combine data into input features
        input_features = [
            station_id,
            openweather_data["temperature"],
            openweather_data["humidity"],
            openweather_data["pressure"],
            hour,
            station_hour,
            day_of_week,
        ]
        
        # Convert to DataFrame
        columns = ['station_id', 'temperature', 'humidity', 'pressure', 'hour', 'station_hour', 'day_of_week']
        input_df = pd.DataFrame([input_features], columns=columns)
        
        logger.info(f"Input features: {json.dumps(input_features)}")
        
        # Make prediction
        prediction = model.predict(input_df)
        predicted_bikes = max(0, min(round(prediction[0]), 40))  # Ensure prediction is between 0 and 40
        
        return jsonify({"predicted_available_bikes": predicted_bikes})

    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({"error": "Failed to make prediction"}), 500

def get_station(station_id):
    """Get station data from JCDecaux API"""
    try:
        api_key = os.environ.get('JCDECAUX_API_KEY')
        contract = "dublin"
        url = f"https://api.jcdecaux.com/vls/v1/stations/{station_id}?contract={contract}&apiKey={api_key}"
        
        response = requests.get(url)
        response.raise_for_status()
        station_data = response.json()
        
        return {
            'number': station_data['number'],
            'name': station_data['name'],
            'bike_stands': station_data['bike_stands'],
            'status': station_data['status']
        }
    except Exception as e:
        logger.error(f"Error fetching station {station_id}: {str(e)}")
        return None

def get_weather_data():
    """Get current weather data"""
    try:
        api_key = os.environ.get('OPENWEATHER_API_KEY')
        url = f"https://api.openweathermap.org/data/2.5/weather?lat=53.3498&lon=-6.2603&appid={api_key}&units=metric"
        
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error fetching weather data: {str(e)}")
        return None

def normalize_prediction(raw_prediction, max_bikes):
    """
    Normalize the raw prediction to a value between 0 and max_bikes
    using a modified sigmoid function with scaling
    """
    # First, apply a scaling factor to make the sigmoid more sensitive
    scaled_prediction = raw_prediction * 0.1  # Reduce the magnitude of extreme values
    
    # Apply sigmoid to get value between 0 and 1
    sigmoid = 1 / (1 + np.exp(-scaled_prediction))
    
    # Scale sigmoid to be centered around 0.5
    centered = (sigmoid - 0.5) * 2  # Now between -1 and 1
    
    # Convert to bike count
    normalized = ((centered + 1) / 2) * max_bikes  # Now between 0 and max_bikes
    
    return normalized

@app.route('/api/station/<int:station_id>/history')
@cache.cached(timeout=300)
def get_station_history(station_id):
    try:
        # Check if model is loaded
        if model is None:
            return jsonify({'error': 'Prediction model not available'}), 503

        # Get cached station data
        station = get_cached_station(station_id)
        if not station:
            station = fetch_station_data(station_id)
            if not station:
                return jsonify({'error': 'Station not found'}), 404

        predictions = []
        current_time = datetime.now().replace(minute=0, second=0, microsecond=0)
        start_hour = 5  # Start at 5 AM
        end_hour = 23   # End at 11 PM
        
        # Get weather data once for all predictions
        weather_data = get_cached_weather(station['position_lat'], station['position_lng'])
        if not weather_data:
            return jsonify({'error': 'Weather data not available'}), 500

        # Generate predictions for each hour from 5 AM to 11 PM
        for hour in range(start_hour, end_hour + 1):
            prediction_time = current_time.replace(hour=hour)
            
            try:
                # Prepare input features
                input_features = prepare_features(station, weather_data, prediction_time)
                
                # Make prediction
                raw_prediction = model.predict(input_features)[0]
                
                # Normalize prediction to get actual number of bikes
                available_bikes = max(0, min(station['bike_stands'], round(normalize_prediction(raw_prediction, station['bike_stands']))))
                available_stands = station['bike_stands'] - available_bikes
                
                predictions.append({
                    'timestamp': prediction_time.strftime('%H:%M'),
                    'available_bikes': available_bikes,
                    'available_stands': available_stands
                })
                
            except Exception as e:
                # Skip this hour if prediction fails
                continue

        if not predictions:
            return jsonify({'error': 'No predictions generated'}), 500

        # Sort predictions by timestamp
        predictions.sort(key=lambda x: x['timestamp'])
        return jsonify(predictions)
        
    except Exception as e:
        return jsonify({'error': 'Failed to generate predictions'}), 500

def prepare_features(station, weather_data, prediction_time):
    try:
        # Prepare features to match the model's expected input
        features = pd.DataFrame([{
            'hour': prediction_time.hour,
            'day_of_week': prediction_time.weekday(),
            'temperature': weather_data.get('main', {}).get('temp', 0),
            'humidity': weather_data.get('main', {}).get('humidity', 0),
            'pressure': weather_data.get('main', {}).get('pressure', 0),
            'station_id': str(station['number'])  # Convert to string for categorical
        }])
        
        # Add station_hour as a categorical feature
        features['station_hour'] = f"{station['number']}_{prediction_time.hour}"
        
        # Scale numerical features
        features['temperature'] = (features['temperature'] - 5) / (30 - (-5))  # Scale from -5 to 30
        features['pressure'] = (features['pressure'] - 980) / (1030 - 980)  # Scale from 980 to 1030
        features['humidity'] = features['humidity'] / 100.0  # Scale from 0 to 100
        features['hour'] = features['hour'] / 23.0  # Scale from 0 to 23
        features['day_of_week'] = features['day_of_week'] / 6.0  # Scale from 0 to 6
        
        return features
        
    except Exception as e:
        raise

def fetch_weather_data(lat, lng):
    try:
        api_key = os.getenv('OPENWEATHER_API_KEY')
        url = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lng}&appid={api_key}&units=metric"
        response = requests.get(url)
        return response.json() if response.status_code == 200 else None
    except Exception:
        return None

def fetch_station_data(station_id):
    try:
        conn = get_db_connection()
        if not conn:
            return None
            
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT * FROM station WHERE number = %s", (station_id,))
            result = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            if result:
                return result[0]
            return None
                
        except Exception as e:
            logger.error(f"Error executing query: {str(e)}")
            cursor.close()
            conn.close()
            return None
            
    except Exception as e:
        logger.error(f"Error in fetch_station_data: {str(e)}")
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
        return None

# Run the app
if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5500, debug=True, use_reloader=False)