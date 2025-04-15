import unittest
import sys
import os
from datetime import datetime, timezone, timedelta
import json
from unittest.mock import patch, MagicMock
import numpy as np

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from Project.app import app, fetch_openweather_forecast

class TestBikeApp(unittest.TestCase):
    def setUp(self):
        """Set up test client and other test variables"""
        self.app = app.test_client()
        self.app.testing = True

    def test_index_route(self):
        """Test the index route returns 200 status code"""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)

    @patch('requests.get')
    def test_fetch_openweather_forecast(self, mock_get):
        """Test the weather forecast fetching function"""
        # Mock response data
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "list": [
                {
                    "dt": int(datetime.now(timezone.utc).timestamp()),
                    "main": {
                        "temp": 15.5,
                        "humidity": 80,
                        "pressure": 1013
                    },
                    "position": {
                        "lat": 53.3498,
                        "lng": -6.2603
                    }
                }
            ]
        }
        mock_get.return_value = mock_response

        # Test the function
        test_datetime = datetime.now(timezone.utc)
        result = fetch_openweather_forecast(test_datetime)

        # Assertions
        self.assertIsNotNone(result)
        self.assertEqual(result["temperature"], 15.5)
        self.assertEqual(result["humidity"], 80)
        self.assertEqual(result["pressure"], 1013)

    def test_stations_route(self):
        """Test the stations route"""
        # Mock database response
        mock_stations = [{
            "number": 1,
            "name": "Test Station",
            "address": "Test Address",
            "position": {
                "lat": 53.3498,
                "lng": -6.2603
            },
            "status": "OPEN",
            "available_bikes": 5,
            "available_bike_stands": 10
        }]
        
        with patch('mysql.connector.connect') as mock_connect:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_connect.return_value = mock_conn
            mock_conn.cursor.return_value = mock_cursor
            mock_cursor.fetchall.return_value = mock_stations
            
            response = self.app.get('/stations')
            data = json.loads(response.data)

            self.assertEqual(response.status_code, 200)
            self.assertIn('stations', data)
            self.assertEqual(len(data['stations']), 1)
            self.assertEqual(data['stations'][0]['number'], 1)
            self.assertEqual(data['stations'][0]['name'], 'Test Station')

    @patch('Project.app.model')
    @patch('Project.app.fetch_openweather_forecast')
    def test_predict_route(self, mock_forecast, mock_model):
        """Test the prediction route"""
        # Mock model prediction
        mock_model.predict.return_value = np.array([10.0])
        
        # Mock weather forecast response
        mock_forecast.return_value = {
            "temperature": 15.5,
            "humidity": 80,
            "pressure": 1013,
            "position": {
                "lat": 53.3498,
                "lng": -6.2603
            }
        }

        # Test parameters with future time (use naive datetime for comparison)
        future_time = datetime.now() + timedelta(hours=2)  # Add 2 hours to ensure it's in the future
        test_params = {
            'date': future_time.strftime('%Y-%m-%d'),
            'time': future_time.strftime('%H:%M:%S'),
            'station_id': '1'
        }

        response = self.app.get('/predict', query_string=test_params)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('predicted_available_bikes', data)
        self.assertEqual(data['predicted_available_bikes'], 10)

    @patch('Project.app.model')
    def test_predict_route_invalid_params(self, mock_model):
        """Test the prediction route with invalid parameters"""
        # Mock model prediction
        mock_model.predict.return_value = np.array([10.0])
        
        # Test missing parameters
        response = self.app.get('/predict')
        self.assertEqual(response.status_code, 400)

        # Test invalid date format
        test_params = {
            'date': 'invalid-date',
            'time': '12:00:00',
            'station_id': '1'
        }
        response = self.app.get('/predict', query_string=test_params)
        self.assertEqual(response.status_code, 400)

        # Test past time
        past_time = datetime.now(timezone.utc) - timedelta(hours=1)
        test_params = {
            'date': past_time.strftime('%Y-%m-%d'),
            'time': past_time.strftime('%H:%M:%S'),
            'station_id': '1'
        }
        response = self.app.get('/predict', query_string=test_params)
        self.assertEqual(response.status_code, 400)

if __name__ == '__main__':
    unittest.main() 