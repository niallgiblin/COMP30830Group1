
import requests
import json
import time
import datetime
import os
import traceback
import mysql.connector

API_KEY = "49e68d2d5153f2954850d6d9fe80295cbe9c62d2"
CONTRACT = "dublin"
BASE_URL = "https://api.jcdecaux.com/vls/v1/stations"

OPENWEATHER_API_KEY = "bbb1afd7234b528c8cdde75cd98bcf5e"
CITY = "Dublin"
OPENWEATHER_URL = "http://api.openweathermap.org/data/2.5/weather?q=Dublin,&APPID=bbb1afd7234b528c8cdde75cd98bcf5e&units=metric"


DB_HOST = "localhost"  # Change if needed
DB_USER = "root"  # Your MySQL username
DB_PASSWORD = "0ct0Shark"  # Your MySQL password
DB_NAME = "bike_data"  # The name of your database

def connect_to_db():
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        return conn
    except mysql.connector.Error as err:
        print(f"Error: {err}")
        return None

# Insert station data into MySQL
def insert_station_data(station):
    try:
        conn = connect_to_db()
        if conn:
            cursor = conn.cursor()

            # Insert into 'station' table
            station_query = """
            INSERT INTO station (number, name, address, position_lat, position_lng, bike_stands)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), 
                                    position_lat=VALUES(position_lat), position_lng=VALUES(position_lng), 
                                    bike_stands=VALUES(bike_stands);
            """
            station_values = (
                station.get("number"),
                station.get("name"),
                station.get("address"),
                station["position"].get("lat"),
                station["position"].get("lng"),
                station.get("bike_stands", 0)
            )

            cursor.execute(station_query, station_values)
            conn.commit()

            # Insert into 'availability' table
            availability_query = """
            INSERT INTO availability (number, last_update, available_bikes, available_bike_stands, status)
            VALUES (%s, %s, %s, %s, %s);
            """
            availability_values = (
                station.get("number"),
                datetime.datetime.now(),  # Insert the current time for the 'last_update'
                station.get("available_bikes", 0),
                station.get("available_bike_stands", 0),
                station.get("status", "")
            )

            cursor.execute(availability_query, availability_values)
            conn.commit()

            cursor.close()
            conn.close()
            print(f"Station {station.get('number')} inserted into database.")
    except Exception as e:
        print(f"Error inserting station: {e}")

def fetch_station_locations():
    try:
        conn = connect_to_db()
        if not conn:
            return []

        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT number, position_lat, position_lng FROM station")
        stations = cursor.fetchall()

        cursor.close()
        conn.close()
        return stations
    except Exception as e:
        print(f"Error fetching station locations: {e}")
        return []
    
def fetch_weather_data(lat, lng):
    try:
        params = {
            "lat": lat,
            "lon": lng,
            "appid": OPENWEATHER_API_KEY,
            "units": "metric",
            "exclude": "minutely,hourly"  # Exclude unnecessary data
        }
        r = requests.get(OPENWEATHER_URL, params=params)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"Error fetching weather data for ({lat}, {lng}): {e}")
        return None

def insert_current_weather(station_number, data):
    try:
        conn = connect_to_db()
        if not conn:
            return

        cursor = conn.cursor()

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

        values = (
            datetime.datetime.fromtimestamp(data["current"]["dt"]),
            data["current"].get("feels_like"),
            data["current"].get("humidity"),
            data["current"].get("pressure"),
            datetime.datetime.fromtimestamp(data["current"]["sunrise"]),
            datetime.datetime.fromtimestamp(data["current"]["sunset"]),
            data["current"].get("temp"),
            data["current"].get("uvi"),
            data["current"]["weather"][0]["id"] if "weather" in data["current"] else None,
            data["current"].get("wind_gust", 0),
            data["current"].get("wind_speed", 0),
            data["current"].get("rain", {}).get("1h", 0),
            data["current"].get("snow", {}).get("1h", 0),
        )

        cursor.execute(query, values)
        conn.commit()
        cursor.close()
        conn.close()
        print(f"Inserted current weather data for station {station_number}.")
    except Exception as e:
        print(f"Error inserting current weather for station {station_number}: {e}")

def insert_daily_weather(station_number, data):
    try:
        conn = connect_to_db()
        if not conn:
            return

        cursor = conn.cursor()

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
                datetime.datetime.fromtimestamp(day["dt"]),
                day.get("humidity"),
                day.get("pop"),
                day.get("pressure"),
                day["temp"]["max"],
                day["temp"]["min"],
                day.get("uvi"),
                day["weather"][0]["id"] if "weather" in day else None,
                day.get("wind_speed", 0),
                day.get("wind_gust", 0),
                day.get("rain", 0),
                day.get("snow", 0),
            )

            cursor.execute(query, values)

        conn.commit()
        cursor.close()
        conn.close()
        print(f"Inserted daily weather data for station {station_number}.")
    except Exception as e:
        print(f"Error inserting daily weather for station {station_number}: {e}")


# Will be used to store text in a file
def write_to_file(text):
    # I first need to create a folder data where the files will be stored.
    if not os.path.exists('data'):
        os.mkdir('data')
        print("Folder 'data' created!")
    else:
        print("Folder 'data' already exists.")

    # now is a variable from datetime, which will go in {}.
    # replace is replacing white spaces with underscores in the file names
    now = datetime.datetime.now()
    with open(f"data/bikes_{now}".replace(" ", "_"), "w") as f:
        f.write(text)

def main():
    while True:
        try:
            # Make request to the API
            r = requests.get(BASE_URL, params={"apiKey": API_KEY, "contract": CONTRACT})
            print(r)
            data = r.json()  # Parse the JSON response from the API

            # Write the data to a file
            write_to_file(r.text)

            # Insert each station into the MySQL database
            for station in data:
                insert_station_data(station)

            stations = fetch_station_locations()

            # 🌦 Fetch & Store Weather Data for Each Station
            for station in stations:
                weather_data = fetch_weather_data(station["position_lat"], station["position_lng"])
                if weather_data:
                    insert_current_weather(station["number"], weather_data)
                    insert_daily_weather(station["number"], weather_data)


            time.sleep(60 * 60)  # Wait for 1 hour before making another request
        except Exception as e:
            print(f"Error: {traceback.format_exc()}")

if __name__ == "__main__":
    main()