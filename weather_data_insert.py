import requests
import mysql.connector
import datetime
import time
import traceback

OPENWEATHER_API_KEY = "0229c04e97b6ed56800bc4b7ce534388"
CITY = "Dublin"
OPENWEATHER_URL = "http://api.openweathermap.org/data/3.0/onecall"

db_config = {
    "host": "localhost",
    "user": "root",
    "password": "River2022!",  # This is Niall's local pw, you'll need to change it to match yours
    "database": "local_databasejcdecaux"
}

def fetch_station_locations(cursor):
    try:
        cursor.execute("SELECT number, position_lat, position_lng FROM station")
        stations = cursor.fetchall()
        return stations
    except Exception as e:
        print(f"Error fetching station locations: {e}")
        return []

def fetch_weather_data(lat, lng):
    try:
        OPENWEATHER_URL = "https://api.openweathermap.org/data/3.0/onecall"
        
        params = {
            "lat": lat,
            "lon": lng,
            "appid": OPENWEATHER_API_KEY,  # ✅ Only one appid
            "units": "metric",
            "exclude": "minutely,hourly"  # ✅ Correct usage
        }

        r = requests.get(OPENWEATHER_URL, params=params)
        r.raise_for_status()  # Raise an error for bad responses (400, 404, etc.)
        
        return r.json()
    except requests.exceptions.RequestException as e:
        print(f"🚨 Error fetching weather data for ({lat}, {lng}): {e}")
        return None

def insert_current_weather(cursor, station_number, data):
    try:
        if "current" not in data:
            print(f"No 'current' data found for station {station_number}.")
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
        print(f"Inserted current weather data for station {station_number}.")
    except Exception as e:
        print(f"Error inserting current weather for station {station_number}: {e}")

def insert_daily_weather(cursor, station_number, data):
    try:
        if "daily" not in data:
            print(f"No 'daily' data found for station {station_number}.")
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

        print(f"Inserted daily weather data for station {station_number}.")
    except Exception as e:
        print(f"Error inserting daily weather for station {station_number}: {e}")

def main():
    try:
        # Connect to MySQL
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        while True:
            stations = fetch_station_locations(cursor)

            # 🌦 Fetch & Store Weather Data for Each Station
            for station in stations:
                weather_data = fetch_weather_data(station["position_lat"], station["position_lng"])
                if weather_data:
                    insert_current_weather(cursor, station["number"], weather_data)
                    insert_daily_weather(cursor, station["number"], weather_data)

            conn.commit()  # Commit after processing all stations
            time.sleep(60 * 60)  # Wait for 1 hour before making another request

    except Exception as e:
        print(f"Error: {traceback.format_exc()}")
    finally:
        # Close the connection only when the program is done
        if conn.is_connected():
            cursor.close()
            conn.close()
            print("MySQL connection closed.")

if __name__ == "__main__":
    main()