from flask import Flask, g, render_template, jsonify, current_app, request
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv
import requests
from datetime import datetime, timezone, timedelta
import pickle
import numpy as np
import sklearn
import json
import pandas as pd
import logging

# Load environment variables
load_dotenv()

# Load the machine learning model
model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'bike_availability_model.pkl')
with open(model_path, 'rb') as f:
    model = pickle.load(f)

# Load historical data
data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'final_data_for_ml.csv')
historical_data = pd.read_csv(data_path)

# Create Flask app
app = Flask(__name__, static_url_path='/static')

# Configuration from .env variables
app.config['GOOGLE_MAPS_API_KEY'] = os.environ.get('GOOGLE_MAPS_API_KEY')
app.config['DB_USER'] = os.environ.get('DB_USER')
app.config['DB_PASSWORD'] = os.environ.get('DB_PASSWORD')
app.config['DB_PORT'] = os.environ.get('DB_PORT', '3306')
app.config['DB_NAME'] = os.environ.get('DB_NAME')
app.config['DB_HOST'] = os.environ.get('DB_HOST', '127.0.0.1')

# Connect to the database
def connect_to_db():
    try:
        connection_string = f"mysql+pymysql://{app.config['DB_USER']}:{app.config['DB_PASSWORD']}@{app.config['DB_HOST']}:{app.config['DB_PORT']}/{app.config['DB_NAME']}"
        engine = create_engine(connection_string, pool_recycle=3600)
        
        # Test the connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            
        return engine
    except Exception as e:
        print(f"Database connection failed: {str(e)}")
        return None

# Get database connection from Flask g object
def get_db():
    db_engine = getattr(g, '_database', None)
    if db_engine is None:
        db_engine = g._database = connect_to_db()
    return db_engine

# Close database connection when request ends
@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.dispose()

# Home page route
@app.route('/')
def index():
    return render_template('index.html', google_maps_api_key=app.config['GOOGLE_MAPS_API_KEY'])

# API route to get all stations
@app.route('/stations')
def get_stations():
    try:
        engine = get_db()
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT 
                    number,
                    name,
                    address,
                    position_lat, 
                    position_lng,
                    status
                FROM station
            """))
            
            stations = [dict(row) for row in result.mappings()]
            return jsonify({"stations": stations})
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
# API route to get availability for a specific station
@app.route("/available/<int:station_id>")
def get_station_availability(station_id):
    try:
        engine = get_db()
        with engine.connect() as conn:
            # Check if station exists first
            station_exists = conn.execute(
                text("SELECT 1 FROM station WHERE number = :station_id"),
                {"station_id": station_id}
            ).scalar()
            
            if not station_exists:
                return jsonify({
                    "error": "Station not found",
                    "available_bikes": 0,
                    "available_bike_stands": 0
                }), 404

            # Get latest availability
            result = conn.execute(
                text("""
                    SELECT 
                        COALESCE(available_bikes, 0) as available_bikes,
                        COALESCE(available_bike_stands, 0) as available_bike_stands,
                        COALESCE(last_update, NOW()) as last_update
                    FROM availability 
                    WHERE number = :station_id
                    ORDER BY last_update DESC 
                    LIMIT 1
                """),
                {"station_id": station_id}
            ).fetchone()
            
            return jsonify({
                "available_bikes": result.available_bikes,
                "available_bike_stands": result.available_bike_stands,
                "last_updated": result.last_update.isoformat() if result.last_update else datetime.now().isoformat()
            })
            
    except Exception as e:
        print(f"Error fetching availability for station {station_id}: {str(e)}")
        return jsonify({
            "error": "Database error",
            "available_bikes": 0,
            "available_bike_stands": 0,
            "last_updated": datetime.now().isoformat()
        }), 200  # Note: Returning 200 with zeros to keep frontend working
    
@app.route('/api/weather')
def get_weather():
    try:
        api_key = os.environ.get('OPENWEATHER_API_KEY')
        response = requests.get(
            f"https://api.openweathermap.org/data/2.5/weather?q=Dublin&appid={api_key}&units=metric"
        )
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        print(f"Weather API error: {str(e)}")
        return jsonify({
            "error": "Weather data unavailable",
            "timestamp": datetime.now().isoformat()
        }), 200


### PREDICTION
def fetch_openweather_forecast(datetime):
    # Stub: Replace with code to fetch weather forecast from OpenWeather
    api_key = os.environ.get('OPENWEATHER_API_KEY')
    url = (f"https://api.openweathermap.org/data/2.5/forecast?q=Dublin&appid={api_key}&units=metric"
        )
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()

    try:
        target_dt = int(datetime.replace(tzinfo=timezone.utc).timestamp())
    except ValueError as ve:
        print(f"Date/time parsing error: {ve}")
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
        if not date or not time or not station_id:
            return jsonify({"error": "Missing date, time, or station_id parameter"}), 400
        if int(station_id) > 117:
            return jsonify({"error": f"Invalid station_id: {station_id}"}), 400

        # Combine date and time into a single datetime object
        dt = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M:%S")
        hour = dt.hour
        day_of_week = dt.weekday()
        station_hour = f"{str(station_id)}_{hour}"

        openweather_data = fetch_openweather_forecast(dt)
        print("Weather data:", openweather_data) ##PRINTING to check

        # Combine data into input features
        input_features = [
            int(station_id),
            openweather_data["temperature"],
            openweather_data["humidity"],
            openweather_data["pressure"],
            hour,
            station_hour,
            day_of_week,
        ]
        import pandas as pd

        columns = ['station_id', 'temperature', 'humidity', 'pressure', 'hour', 'station_hour' ,'day_of_week'] #Convert to df to match with model
        input_df = pd.DataFrame([input_features], columns=columns)


        print("Input features:", input_features) #PRINTING to check
        prediction = model.predict(input_df)
        # Make a prediction
        prediction = model.predict(input_df)
        
        return jsonify({"predicted_available_bikes": prediction[0]})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/station_history/<int:station_id>')
def get_station_history(station_id):
    """Get historical usage data for a station"""
    try:
        # Filter data for the specific station
        station_data = historical_data[historical_data['station_id'] == station_id]
        
        if station_data.empty:
            # If no data for this station, return default pattern
            time_labels = ['05:00', '08:00', '11:00', '14:00', '17:00', '20:00', '23:00']
            usage_pattern = {
                'labels': time_labels,
                'available_bikes': [5, 8, 12, 15, 10, 7, 4],
                'available_stands': [15, 12, 8, 5, 10, 13, 16]
            }
        else:
            # Calculate average bikes available by hour
            hourly_avg = station_data.groupby('hour')['num_bikes_available'].mean().reset_index()
            
            # Ensure we have data for all hours (0-23)
            all_hours = pd.DataFrame({'hour': range(24)})
            hourly_avg = pd.merge(all_hours, hourly_avg, on='hour', how='left')
            hourly_avg['num_bikes_available'] = hourly_avg['num_bikes_available'].fillna(method='ffill').fillna(method='bfill')
            
            # Get total capacity (max bikes + available stands)
            total_capacity = station_data['num_bikes_available'].max() + 5  # Assuming 5 stands as default
            
            # Select specific hours for display (every 3 hours from 5am to midnight)
            selected_hours = [5, 8, 11, 14, 17, 20, 23]
            time_labels = [f"{hour:02d}:00" for hour in selected_hours]
            
            # Get data for selected hours and round to whole numbers
            available_bikes = [round(hourly_avg[hourly_avg['hour'] == hour]['num_bikes_available'].values[0]) for hour in selected_hours]
            available_stands = [round(total_capacity - bikes) for bikes in available_bikes]
            
            usage_pattern = {
                'labels': time_labels,
                'available_bikes': available_bikes,
                'available_stands': available_stands
            }
        
        return jsonify({
            'usagePattern': usage_pattern
        })
    except Exception as e:
        print(f"Error in get_station_history: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Run the app
if __name__ == '__main__':
    # Set up logging
    logging.basicConfig(level=logging.INFO)
    
    # Run the app
    app.run(debug=True, port=5500)