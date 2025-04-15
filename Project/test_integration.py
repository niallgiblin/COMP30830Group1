import unittest
import sys
import os
from datetime import datetime
import json
from dotenv import load_dotenv
import pickle
import mysql.connector

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from Project.app import app

# Load environment variables
load_dotenv()

# Test database configuration
TEST_DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'local_databasejcdecaux'),
    'port': os.getenv('DB_PORT', '3306')
}

class TestBikeAppIntegration(unittest.TestCase):
    def setUp(self):
        """Set up test client and other test variables"""
        self.app = app.test_client()
        self.app.testing = True
        
        # Override app's database config for testing
        app.config['TEST_DB_CONFIG'] = TEST_DB_CONFIG
        
        # Load the ML model
        model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'bike_availability_model.pkl')
        with open(model_path, 'rb') as f:
            self.model = pickle.load(f)

    def test_database_connection(self):
        """Test database connection and basic query"""
        with app.app_context():
            # Use test database config
            conn = mysql.connector.connect(**TEST_DB_CONFIG)
            self.assertIsNotNone(conn)
            
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                self.assertEqual(result[0], 1)
            
            conn.close()

    def test_prediction_with_weather_integration(self):
        """Test the integration between weather API and prediction endpoint"""
        future_time = datetime.now().replace(hour=14, minute=0, second=0, microsecond=0)
        test_params = {
            'date': future_time.strftime('%Y-%m-%d'),
            'time': future_time.strftime('%H:%M:%S'),
            'station_id': '1'
        }

        response = self.app.get('/predict', query_string=test_params)
        if response.status_code != 200:
            print(f"Prediction error: {response.data.decode()}")
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertIn('predicted_available_bikes', data)
        self.assertIsInstance(data['predicted_available_bikes'], (int, float))

    def test_station_availability_integration(self):
        """Test the integration between station data and availability endpoint"""
        # First get all stations
        stations_response = self.app.get('/stations')
        self.assertEqual(stations_response.status_code, 200)
        
        stations_data = json.loads(stations_response.data)
        self.assertIn('stations', stations_data)
        
        if stations_data['stations']:
            # Test availability for the first station
            station_id = stations_data['stations'][0]['number']
            availability_response = self.app.get(f'/available/{station_id}')
            self.assertEqual(availability_response.status_code, 200)
            
            availability_data = json.loads(availability_response.data)
            self.assertIn('available_bikes', availability_data)
            self.assertIn('available_bike_stands', availability_data)

    def test_weather_station_prediction_flow(self):
        """Test the complete flow from weather data to prediction"""
        weather_response = self.app.get('/api/weather')
        self.assertEqual(weather_response.status_code, 200)
        
        weather_data = json.loads(weather_response.data)
        self.assertIn('main', weather_data)
        
        future_time = datetime.now().replace(hour=14, minute=0, second=0, microsecond=0)
        test_params = {
            'date': future_time.strftime('%Y-%m-%d'),
            'time': future_time.strftime('%H:%M:%S'),
            'station_id': '1'
        }
        
        prediction_response = self.app.get('/predict', query_string=test_params)
        if prediction_response.status_code != 200:
            print(f"Prediction error: {prediction_response.data.decode()}")
        self.assertEqual(prediction_response.status_code, 200)
        
        prediction_data = json.loads(prediction_response.data)
        self.assertIn('predicted_available_bikes', prediction_data)

    def test_station_history_integration(self):
        """Test the integration of station history data"""
        # First ensure we have a test station
        with mysql.connector.connect(**TEST_DB_CONFIG) as conn:
            with conn.cursor() as cursor:
                # Create station table if it doesn't exist
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS station (
                        number INT PRIMARY KEY,
                        name VARCHAR(255),
                        address VARCHAR(255),
                        position JSON,
                        banking BOOLEAN,
                        bonus BOOLEAN,
                        status VARCHAR(50),
                        bike_stands INT
                    )
                """)
                # Insert test station data
                cursor.execute("""
                    INSERT INTO station 
                    (number, name, address, position, banking, bonus, status, bike_stands)
                    VALUES 
                    (1, 'Test Station', 'Test Address', '{"lat": 53.3498, "lng": -6.2603}', 1, 0, 'OPEN', 20)
                    ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    address = VALUES(address),
                    position = VALUES(position),
                    banking = VALUES(banking),
                    bonus = VALUES(bonus),
                    status = VALUES(status),
                    bike_stands = VALUES(bike_stands)
                """)
                # Create station_history table if it doesn't exist
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS station_history (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        station_number INT,
                        available_bikes INT,
                        available_stands INT,
                        timestamp DATETIME,
                        FOREIGN KEY (station_number) REFERENCES station(number)
                    )
                """)
                # Insert test history data
                cursor.execute("""
                    INSERT INTO station_history 
                    (station_number, available_bikes, available_stands, timestamp)
                    VALUES 
                    (1, 10, 10, NOW()),
                    (1, 8, 12, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
                    (1, 6, 14, DATE_SUB(NOW(), INTERVAL 2 HOUR))
                """)
                conn.commit()

        station_id = 1
        response = self.app.get(f'/api/station/{station_id}/history')
        if response.status_code != 200:
            print(f"Station history error: {response.data.decode()}")
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertIsInstance(data, list)
        self.assertTrue(len(data) > 0)
        
        first_prediction = data[0]
        self.assertIn('timestamp', first_prediction)
        self.assertIn('available_bikes', first_prediction)
        self.assertIn('available_stands', first_prediction)
        
        invalid_response = self.app.get('/api/station/999/history')
        self.assertEqual(invalid_response.status_code, 404)

    def test_error_handling_integration(self):
        """Test how different components handle errors together"""
        # Test missing API keys
        with app.app_context():
            # Temporarily remove API keys
            original_weather_key = os.environ.get('OPENWEATHER_API_KEY')
            os.environ['OPENWEATHER_API_KEY'] = 'invalid_key'
            
            response = self.app.get('/api/weather')
            self.assertEqual(response.status_code, 401)
            
            # Restore API key
            os.environ['OPENWEATHER_API_KEY'] = original_weather_key

if __name__ == '__main__':
    unittest.main() 