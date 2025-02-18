import requests
import mysql.connector

# API and Database details
API_URL = "https://api.jcdecaux.com/vls/v1/stations?contract=dublin&apiKey=YOUR_API_KEY"

db_config = {
    "host": "localhost",
    "user": "root",
    "password": "your_password",
    "database": "bike_data"
}

# Fetch data from API
response = requests.get(API_URL)
stations = response.json()

# Connect to MySQL
conn = mysql.connector.connect(**db_config)
cursor = conn.cursor()

# Insert data into station table
station_sql = """
INSERT INTO station (number, name, address, position_lat, position_lng, bike_stands)
VALUES (%s, %s, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), 
position_lat=VALUES(position_lat), position_lng=VALUES(position_lng), bike_stands=VALUES(bike_stands);
"""

availability_sql = """
INSERT INTO availability (number, last_update, available_bikes, available_bike_stands, status)
VALUES (%s, NOW(), %s, %s, %s);
"""

for station in stations:
    station_data = (
        station["number"], station["name"], station["address"],
        station["position"]["lat"], station["position"]["lng"], station["bike_stands"]
    )
    cursor.execute(station_sql, station_data)

    availability_data = (
        station["number"], station["available_bikes"], station["available_bike_stands"], station["status"]
    )
    cursor.execute(availability_sql, availability_data)

# Commit and close
conn.commit()
cursor.close()
conn.close()

print("Data inserted successfully!")