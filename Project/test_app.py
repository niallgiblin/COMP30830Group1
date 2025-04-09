import unittest
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from Project.app import app, fetch_openweather_forecast
from datetime import datetime, timezone
import json
from unittest.mock import patch, MagicMock

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

    @patch('requests.get')
    def test_stations_route(self, mock_get):
        """Test the stations route"""
        # Mock JCDecaux API response
        mock_response = MagicMock()
        mock_response.json.return_value = [{
            "number": 1,
            "name": "Test Station",
            "address": "Test Address",
            "position": {"lat": 53.3498, "lng": -6.2603},
            "status": "OPEN",
            "available_bikes": 5,
            "available_bike_stands": 10,
            "last_update": int(datetime.now().timestamp() * 1000)
        }]
        mock_get.return_value = mock_response

        # Test the route
        response = self.app.get('/stations')
        data = json.loads(response.data)

        # Assertions
        self.assertEqual(response.status_code, 200)
        self.assertIn('stations', data)
        self.assertEqual(len(data['stations']), 1)
        self.assertEqual(data['stations'][0]['number'], 1)
        self.assertEqual(data['stations'][0]['name'], 'Test Station')

    @patch('requests.get')
    def test_predict_route(self, mock_get):
        """Test the prediction route"""
        # Mock weather API response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "list": [
                {
                    "dt": int(datetime.now(timezone.utc).timestamp()),
                    "main": {
                        "temp": 15.5,
                        "humidity": 80,
                        "pressure": 1013
                    }
                }
            ]
        }
        mock_get.return_value = mock_response

        # Test parameters
        test_params = {
            'date': '2024-04-08',
            'time': '12:00:00',
            'station_id': '1'
        }

        # Test the route
        response = self.app.get('/predict', query_string=test_params)
        data = json.loads(response.data)

        # Assertions
        self.assertEqual(response.status_code, 200)
        self.assertIn('predicted_available_bikes', data)

    def test_predict_route_invalid_params(self):
        """Test the prediction route with invalid parameters"""
        # Test missing parameters
        response = self.app.get('/predict')
        self.assertEqual(response.status_code, 400)

        # Test invalid station ID
        test_params = {
            'date': '2024-04-08',
            'time': '12:00:00',
            'station_id': '999'  # Invalid station ID
        }
        response = self.app.get('/predict', query_string=test_params)
        self.assertEqual(response.status_code, 400)

if __name__ == '__main__':
    unittest.main() 