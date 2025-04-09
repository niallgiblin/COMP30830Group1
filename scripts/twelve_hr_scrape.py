import requests
import mysql.connector
import datetime
import time
import traceback
import threading
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'Project', '.env'))

# JCDecaux API constants
JCKEY = os.getenv("JCDECAUX_API_KEY")
NAME = "dublin"
STATIONS_URI = "https://api.jcdecaux.com/vls/v1/stations"

# OpenWeatherMap API constants
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
OPENWEATHER_URL = "https://api.openweathermap.org/data/3.0/onecall"

# Dublin coordinates (latitude and longitude)
DUBLIN_LAT = 53.349805
DUBLIN_LNG = -6.26031

# Database configuration from environment variables
db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME", "local_databasejcdecaux"),
    "port": int(os.getenv("DB_PORT", "3306"))
}

# Function to fetch and insert JCDecaux data
def fetch_and_insert_jcdecaux():
    print("JCDecaux thread started.")
    try:
        # Connect to MySQL
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        while True:
            # Fetch data from JCDecaux API
            response = requests.get(STATIONS_URI, params={"apiKey": JCKEY, "contract": NAME})

            stations = response.json()

            # Insert data into station table
            station_sql = """
            INSERT INTO station (number, contract_name, name, address, position_lat, position_lng, banking, bike_stands, bonus, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), 
            position_lat=VALUES(position_lat), position_lng=VALUES(position_lng), bike_stands=VALUES(bike_stands);
            """

            # Insert into availability table
            availability_sql = """
            INSERT INTO availability (number, available_bikes, available_bike_stands, last_update)
            VALUES (%s, %s, %s, NOW());
            """

            for station in stations:
                station_data = (
                    station["number"], station["contract_name"], station["name"], station["address"],
                    station["position"]["lat"], station["position"]["lng"], station["banking"], station["bike_stands"], station["bonus"], station["status"]
                )
                availability_data = (
                    station["number"], station["available_bikes"], station["available_bike_stands"]
                )

                try:
                    cursor.execute(station_sql, station_data)
                    cursor.execute(availability_sql, availability_data)
                    conn.commit()  # Commit after each station is processed
                    print(f"Inserted data for station {station['number']}.")
                except mysql.connector.Error as e:
                    print(f"Error inserting data for station {station['number']}: {e}")

            time.sleep(5 * 60)  # Wait for 5 minutes before making another request

    except Exception as e:
        print(f"JCDecaux Error: {traceback.format_exc()}")
    finally:
        # Close the connection only when the program is done
        if conn.is_connected():
            cursor.close()
            conn.close()
            print("JCDecaux MySQL connection closed.")
        print("JCDecaux thread stopped.")

# Function to fetch and insert weather data
def fetch_and_insert_weather():
    print("Weather thread started.")
    try:
        # Connect to MySQL
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        while True:
            # Fetch weather data for Dublin
            weather_data = fetch_weather_data(DUBLIN_LAT, DUBLIN_LNG)
            if weather_data:
                # Insert current weather data
                insert_current_weather(cursor, weather_data)
                # Insert daily weather data
                insert_daily_weather(cursor, weather_data)
                conn.commit()  # Commit after inserting weather data
                print("Weather data inserted successfully.")

            time.sleep(60 * 60)  # Wait for 1 hour before making another request

    except Exception as e:
        print(f"Weather Error: {traceback.format_exc()}")
    finally:
        # Close the connection only when the program is done
        if conn.is_connected():
            cursor.close()
            conn.close()
            print("Weather MySQL connection closed.")
        print("Weather thread stopped.")

# Function to fetch weather data from OpenWeatherMap API
def fetch_weather_data(lat, lng):
    try:
        params = {
            "lat": lat,
            "lon": lng,
            "appid": OPENWEATHER_API_KEY,
            "units": "metric",
            "exclude": "minutely,hourly"
        }
        r = requests.get(OPENWEATHER_URL, params=params)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data for ({lat}, {lng}): {e}")
        return None

# Function to insert current weather data
def insert_current_weather(cursor, data):
    try:
        if "current" not in data:
            print("No 'current' data found.")
            return

        query = """
        INSERT INTO current (dt, feels_like, humidity, pressure, sunrise, sunset, temp, uvi, weather_id, wind_gust, wind_speed, rain_1h, snow_1h)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE feels_like=VALUES(feels_like), humidity=VALUES(humidity), 
                                pressure=VALUES(pressure), sunrise=VALUES(sunrise), 
                                sunset=VALUES(sunset), temp=VALUES(temp), 
                                uvi=VALUES(uvi), weather_id=VALUES(weather_id), 
                                wind_gust=VALUES(wind_gust), wind_speed=VALUES(wind_speed), 
                                rain_1h=VALUES(rain_1h), snow_1h=VALUES(snow_1h);
        """

        current = data["current"]
        values = (
            datetime.datetime.fromtimestamp(current.get("dt")),
            current.get("feels_like"),
            current.get("humidity"),
            current.get("pressure"),
            datetime.datetime.fromtimestamp(current.get("sunrise")),
            datetime.datetime.fromtimestamp(current.get("sunset")),
            current.get("temp"),
            current.get("uvi"),
            current["weather"][0]["id"] if "weather" in current else None,
            current.get("wind_gust", 0),
            current.get("wind_speed", 0),
            current.get("rain", {}).get("1h", 0),
            current.get("snow", {}).get("1h", 0),
        )

        cursor.execute(query, values)
        print("Inserted current weather data.")
    except Exception as e:
        print(f"Error inserting current weather: {e}")

# Function to insert daily weather data
def insert_daily_weather(cursor, data):
    try:
        if "daily" not in data:
            print("No 'daily' data found.")
            return

        query = """
        INSERT INTO daily (dt, future_dt, humidity, pop, pressure, temp_max, temp_min, uvi, weather_id, wind_speed, wind_gust, rain, snow)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE humidity=VALUES(humidity), pop=VALUES(pop), 
                                pressure=VALUES(pressure), temp_max=VALUES(temp_max), 
                                temp_min=VALUES(temp_min), uvi=VALUES(uvi), 
                                weather_id=VALUES(weather_id), wind_speed=VALUES(wind_speed), 
                                wind_gust=VALUES(wind_gust), rain=VALUES(rain), 
                                snow=VALUES(snow);
        """

        for day in data["daily"]:
            values = (
                datetime.datetime.fromtimestamp(data["current"]["dt"]),
                datetime.datetime.fromtimestamp(day.get("dt")),
                day.get("humidity"),
                day.get("pop"),
                day.get("pressure"),
                day["temp"].get("max"),
                day["temp"].get("min"),
                day.get("uvi"),
                day["weather"][0]["id"] if "weather" in day else None,
                day.get("wind_speed", 0),
                day.get("wind_gust", 0),
                day.get("rain", 0),
                day.get("snow", 0),
            )

            cursor.execute(query, values)

        print("Inserted daily weather data.")
    except Exception as e:
        print(f"Error inserting daily weather: {e}")

# Main function to run both scripts
def main():
    # Create threads for JCDecaux and Weather scripts
    jcdecaux_thread = threading.Thread(target=fetch_and_insert_jcdecaux)
    weather_thread = threading.Thread(target=fetch_and_insert_weather)

    # Start the threads
    jcdecaux_thread.start()
    weather_thread.start()

    # Run for 12 hours (43200 seconds)
    time.sleep(43200)

    # Stop the threads after 12 hours
    jcdecaux_thread.join()
    weather_thread.join()

if __name__ == "__main__":
    main()