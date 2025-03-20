from flask import Flask, g, render_template, jsonify
import json
from sqlalchemy import create_engine, text

app = Flask(__name__, static_url_path='/static') # tell Flask where are the static files (html, js, images, css, etc.)
app.config['GOOGLE_MAPS_API_KEY'] = 'AIzaSyByv0VXneSKOmPsEfijAVFabcoRf7Okdrk'

@app.route('/')
def index():
    return render_template('index.html', google_maps_api_key=app.config['GOOGLE_MAPS_API_KEY'])

'''
We will connect to the local database, access its content through flask, and 
then show the content in a specific page in the form of a json file
'''
## LEONIE taken form create_db.py
USER = "root"
PASSWORD = "River2022!"
PORT = "3306"
DB = "local_databasejcdecaux"
URI = "127.0.0.1"

# Connect to the database and create the engine variable
def connect_to_db():
    connection_string = "mysql+pymysql://{}:{}@{}:{}/{}".format(USER, PASSWORD, URI, PORT, DB)
    engine = create_engine(connection_string, echo = True)
    
    return engine

# Create the engine variable and store it in the global Flask variable 'g'
def get_db():
    db_engine = getattr(g, '_database', None)
    if db_engine is None:
        db_engine = g._database = connect_to_db()
    return db_engine

# Show all stations in json
@app.route('/stations')
def get_stations():
    engine = get_db()
    
    stations = []
    with engine.connect() as conn: #Added this part because lecture's code doesn't work: engine doesn't have "execute" function
        query = text("""
                SELECT * FROM station""")
        rows = conn.execute(query)

        #rows = engine.execute("SELECT * from station;") # here station is the name of your table in the database
    
        for row in rows.mappings(): # Added the mappings() function to be able to convert to dictionary
            stations.append(dict(row))
    
    return jsonify(stations=stations)

# Let us retrieve information about a specific station
@app.route("/available/<int:station_id>")
def get_stations_one(station_id):
    engine = get_db()
    data = []

    try:
        with engine.connect() as conn:
            # Use a parameterized query
            query = text("SELECT available_bikes, available_bike_stands FROM availability WHERE number = :station_id;")
            rows = conn.execute(query, {"station_id": station_id})  # Pass parameters as a dictionary

            for row in rows.mappings():
                data.append(dict(row))
        
        return jsonify(available=data)
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route('/')
def root():
    return 'Navigate http://localhost:5500/'

if __name__ == '__main__':
    app.run(debug=True, port=5500)