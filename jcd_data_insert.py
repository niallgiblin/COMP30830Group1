import requests
import mysql.connector

# API and Database details
API_URL = "https://api.jcdecaux.com/vls/v1/stations?contract=dublin&apiKey=49e68d2d5153f2954850d6d9fe80295cbe9c62d2"

db_config = {
    "host": "localhost",
    "user": "root",
    "password": "River2022!",
    "database": "local_databasejcdecaux"
}

# Fetch data from API
response = requests.get(API_URL)
stations = response.json()

# Connect to MySQL
conn = mysql.connector.connect(**db_config)
cursor = conn.cursor()

# Insert data into station table
station_sql = """
INSERT INTO station (number, contract_name, name, address, position_lat, position_lng, banking, bike_stands, bonus, status)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), 
position_lat=VALUES(position_lat), position_lng=VALUES(position_lng), bike_stands=VALUES(bike_stands);
"""

availability_sql = """
INSERT INTO availability (number, available_bikes, available_bike_stands, last_update)
VALUES (%s, %s, %s, NOW());
"""

for station in stations:
    station_data = (
        station["number"], station["contract_name"], station["name"], station["address"],
        station["position"]["lat"], station["position"]["lng"], station["banking"], station["bike_stands"], station["bonus"], station["status"]
    )
    cursor.execute(station_sql, station_data)

    availability_data = (
        station["number"], station["available_bikes"], station["available_bike_stands"]
    )
    cursor.execute(availability_sql, availability_data)

# Commit and close
conn.commit()
cursor.close()
conn.close()

print("Data inserted successfully!")