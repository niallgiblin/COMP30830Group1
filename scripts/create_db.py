import requests
from sqlalchemy import create_engine, text
import traceback
import time
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'Project', '.env'))

# Database configuration from environment variables
USER = os.getenv("DB_USER", "root")
PASSWORD = os.getenv("DB_PASSWORD")
PORT = os.getenv("DB_PORT", "3306")
DB = os.getenv("DB_NAME", "local_databasejcdecaux")
URI = os.getenv("DB_HOST", "127.0.0.1")

connection_string = f"mysql+pymysql://{USER}:{PASSWORD}@{URI}:{PORT}"

engine = create_engine(connection_string, echo=True)

# Create a connection and ensure the database exists
with engine.connect() as connection:
    connection.execute(text(f"CREATE DATABASE IF NOT EXISTS {DB};"))
    connection.commit()

# Update the engine to use the newly created database
engine = create_engine(f"{connection_string}/{DB}", echo=True)

with engine.connect() as connection:
    # Create station table
    sql = text('''
    CREATE TABLE IF NOT EXISTS station (
        number INTEGER,
        contract_name VARCHAR(256),
        name VARCHAR(256),
        address VARCHAR(256), 
        position_lat REAL,
        position_lng REAL,
        banking INTEGER,
        bikestands INTEGER,
        bonus INTEGER,
        status VARCHAR(256)
    );
    ''')
    connection.execute(sql)
    connection.commit()

    # Create availability table
    sql = text("""
    CREATE TABLE IF NOT EXISTS availability (
        number INTEGER,
        available_bikes INTEGER,
        available_bike_stands INTEGER,
        last_update DATETIME
    );
    """)
    connection.execute(sql)
    connection.commit()

    # Create current (weather) table
    sql = text("""
    CREATE TABLE IF NOT EXISTS current (
        dt DATETIME PRIMARY KEY,
        feels_like FLOAT,
        humidity INT,
        pressure INT,
        sunrise DATETIME,
        sunset DATETIME,
        temp FLOAT,
        uvi FLOAT,
        weather_id INT,
        wind_gust FLOAT,
        wind_speed FLOAT,
        rain_1h FLOAT DEFAULT 0,
        snow_1h FLOAT DEFAULT 0
    );
    """)           
    connection.execute(sql)
    connection.commit()

    # Create daily (weather) table
    sql = text("""
    CREATE TABLE IF NOT EXISTS daily (
        dt DATETIME,
        future_dt DATETIME,
        humidity INT,
        pop FLOAT,
        pressure INT,
        temp_max FLOAT,
        temp_min FLOAT,
        uvi FLOAT,
        weather_id INT,
        wind_speed FLOAT,
        wind_gust FLOAT,
        rain FLOAT DEFAULT 0,
        snow FLOAT DEFAULT 0,
        PRIMARY KEY (dt, future_dt)  -- Ensures unique records for each day
    );
    """)           
    connection.execute(sql)
    connection.commit()

    # Print database variables
    for res in connection.execute(text("SHOW VARIABLES;")):
        print(res)

    # Print table structure
    tab_structure = connection.execute(text("SHOW COLUMNS FROM station;"))
    print(tab_structure.fetchall())

# JCDecaux API
JCKEY = os.getenv("JCDECAUX_API_KEY")
NAME = "dublin"
STATIONS_URI = "https://api.jcdecaux.com/vls/v1/stations"

def stations_to_db(text):
    # let us load the stations from the text received from jcdecaux
    stations = json.loads(text)
    
    # print type of the stations object, and number of stations
    print(type(stations), len(stations))
    
    # print the type of the object stations (a dictionary) and load the content
    for station in stations:
        print(type(station))
        
        # let us extract the relevant info from the dictionary
        vals = (int(station.get('number')), station.get('contract_name'), station.get('address'), int(station.get('banking')), int(station.get('bike_stands')), 
                station.get('name'), station.get('position_lat'), station.get('position_lng'),int(station.get('bonus')), station.get('status'))
        
        # now let us use the engine to insert into the stations
        connection.execute("""
                          INSERT INTO station (address, banking, bikestands, name, status) 
                          VALUES (%s, %s, %s, %s, %s);
                          """, vals)

def write_to_db(data):
    """
    Write station availability data to the database.
    
    Args:
        data: JSON data containing station availability information
    """
    stations = json.loads(data)
    
    for station in stations:
        # Extract availability data
        number = int(station.get('number'))
        available_bikes = int(station.get('available_bikes', 0))
        available_bike_stands = int(station.get('available_bike_stands', 0))
        last_update = station.get('last_update')
        
        # Insert into availability table
        with engine.connect() as connection:
            connection.execute(text("""
                INSERT INTO availability (number, available_bikes, available_bike_stands, last_update)
                VALUES (:number, :available_bikes, :available_bike_stands, :last_update)
            """), {
                "number": number,
                "available_bikes": available_bikes,
                "available_bike_stands": available_bike_stands,
                "last_update": last_update
            })
            connection.commit()

def main():
    while True:
        try:
            r = requests.get(STATIONS_URI, params={"apiKey": JCKEY, "contract": NAME})
            write_to_db(r.json())
            time.sleep(5*60)
        except Exception:
            print(traceback.format_exc())

if __name__ == "__main__":
    main()