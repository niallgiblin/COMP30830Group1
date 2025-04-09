import unittest
import sys
import os
from sqlalchemy import text

# Add the Project directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from Project.app import app, connect_to_db, get_db
from datetime import datetime, timezone
import json
from dotenv import load_dotenv
import pandas as pd
import pickle

class TestBikeAppIntegration(unittest.TestCase):
    def setUp(self):
        """Set up test client and other test variables"""
        load_dotenv()  # Load environment variables
        self.app = app.test_client()
        self.app.testing = True
        
        # Load the ML model
        model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'bike_availability_model.pkl')
        with open(model_path, 'rb') as f:
            self.model = pickle.load(f)

    def test_database_connection(self):
        """Test database connection and basic query"""
        with app.app_context():
            db = get_db()
            self.assertIsNotNone(db, "Database connection should be established")
            
            # Test a simple query
            try:
                with db.connect() as conn:
                    result = conn.execute(text("SELECT 1")).scalar()
                    self.assertEqual(result, 1, "Basic database query should work")
            except Exception as e:
                self.fail(f"Database query failed: {str(e)}")

    def test_prediction_with_weather_integration(self):
        """Test the integration between weather API and prediction endpoint"""
        # Test parameters
        test_params = {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'time': '12:00:00',
            'station_id': '1'
        }

        # Make request to prediction endpoint
        response = self.app.get('/predict', query_string=test_params)
        data = json.loads(response.data)

        # Assertions
        self.assertEqual(response.status_code, 200, "Prediction endpoint should return 200")
        self.assertIn('predicted_available_bikes', data, "Response should contain prediction")
        self.assertIsInstance(data['predicted_available_bikes'], (int, float), "Prediction should be a number")

    def test_station_availability_integration(self):
        """Test the integration between station data and availability endpoint"""
        # First get all stations
        stations_response = self.app.get('/stations')
        stations_data = json.loads(stations_response.data)
        
        self.assertEqual(stations_response.status_code, 200, "Stations endpoint should return 200")
        self.assertIn('stations', stations_data, "Response should contain stations data")
        
        if stations_data['stations']:
            # Test availability for the first station
            station_id = stations_data['stations'][0]['number']
            availability_response = self.app.get(f'/available/{station_id}')
            availability_data = json.loads(availability_response.data)
            
            self.assertEqual(availability_response.status_code, 200, "Availability endpoint should return 200")
            self.assertIn('available_bikes', availability_data, "Response should contain available bikes")
            self.assertIn('available_bike_stands', availability_data, "Response should contain available stands")

    def test_weather_station_prediction_flow(self):
        """Test the complete flow from weather data to prediction"""
        # Get weather data
        weather_response = self.app.get('/api/weather')
        weather_data = json.loads(weather_response.data)
        
        self.assertEqual(weather_response.status_code, 200, "Weather endpoint should return 200")
        
        # Check for error response
        if 'error' in weather_data:
            self.fail(f"Weather API error: {weather_data['error']}")
            
        self.assertIn('main', weather_data, "Weather response should contain main data")
        
        # Use weather data to make a prediction
        test_params = {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'time': '12:00:00',
            'station_id': '1'
        }
        
        prediction_response = self.app.get('/predict', query_string=test_params)
        prediction_data = json.loads(prediction_response.data)
        
        self.assertEqual(prediction_response.status_code, 200, "Prediction should work with weather data")
        self.assertIn('predicted_available_bikes', prediction_data, "Prediction should be returned")

    def test_station_history_integration(self):
        """Test the integration of station history data"""
        # Test with a valid station ID
        station_id = 1
        response = self.app.get(f'/api/station_history/{station_id}')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200, "Station history endpoint should return 200")
        self.assertIn('usagePattern', data, "Response should contain usage pattern data")
        self.assertIn('available_bikes', data['usagePattern'], "Usage pattern should contain available bikes data")
        self.assertIn('available_stands', data['usagePattern'], "Usage pattern should contain available stands data")
        
        # Test with an invalid station ID
        invalid_response = self.app.get('/api/station_history/999')
        self.assertEqual(invalid_response.status_code, 400, "Invalid station ID should return 400")

    def test_error_handling_integration(self):
        """Test how different components handle errors together"""
        # Test missing API keys
        with app.app_context():
            # Temporarily remove API keys
            original_weather_key = os.environ.get('OPENWEATHER_API_KEY')
            os.environ['OPENWEATHER_API_KEY'] = 'invalid_key'
            
            response = self.app.get('/api/weather')
            self.assertEqual(response.status_code, 401, "Invalid API key should return 401")
            
            # Restore API key
            os.environ['OPENWEATHER_API_KEY'] = original_weather_key

if __name__ == '__main__':
    unittest.main() 