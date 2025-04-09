# COMP30830Group1 - Dublin Bikes Application

A web application for predicting bike availability at Dublin Bikes stations.

## Project Structure

- `Project/` - Flask web application
  - `app.py` - Main application file
  - `test_app.py` - Unit tests
  - `test_integration.py` - Integration tests
  - `templates/` - HTML templates
  - `static/` - Static files (CSS, JS, images)
  - `.env` - Environment variables (not tracked by Git)
  - `.env.example` - Template for environment variables

- `scripts/` - Data collection and database scripts
  - `create_db.py` - Database setup script
  - `twelve_hr_scrape.py` - Data collection script

- `data/` - Data files and ML models
  - `bike_availability_model.pkl` - Trained ML model
  - `final_data_for_ml.csv` - Training data
  - `mldata.ipynb` - Jupyter notebook for ML model development

## Setup

1. Install dependencies:
   ```
   conda env create -f environment.yml
   conda activate SWEpy313
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env` in the Project directory
   - Fill in your actual API keys and database credentials
   ```
   cp Project/.env.example Project/.env
   # Edit Project/.env with your actual credentials
   ```

3. Set up the database:
   ```
   python scripts/create_db.py
   ```

4. Collect data (optional):
   ```
   python scripts/twelve_hr_scrape.py
   ```

5. Run the application:
   ```
   cd Project
   python app.py
   ```

## Environment Variables

The application requires the following environment variables:

- `JCDECAUX_API_KEY` - API key for JCDecaux Dublin Bikes API
- `OPENWEATHER_API_KEY` - API key for OpenWeather API
- `DB_HOST` - Database host (default: localhost)
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name (default: local_databasejcdecaux)
- `DB_PORT` - Database port (default: 3306)
- `FLASK_ENV` - Flask environment (development/production)
- `FLASK_APP` - Flask application file
- `SECRET_KEY` - Secret key for Flask sessions

**Important**: Never commit your `.env` file to version control as it contains sensitive information.

## Features

- Real-time bike availability data from JCDecaux API
- Weather data integration from OpenWeather API
- Machine learning predictions for bike availability
- Interactive map interface
- Station history and usage patterns

## API Endpoints

- `/stations` - Get all stations
- `/available/<station_id>` - Get availability for a specific station
- `/api/weather` - Get current weather data
- `/predict` - Get bike availability prediction
- `/api/station_history/<station_id>` - Get historical data for a station
