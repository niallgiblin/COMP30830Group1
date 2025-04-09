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

2. Set up the database:
   ```
   python scripts/create_db.py
   ```

3. Collect data (optional):
   ```
   python scripts/twelve_hr_scrape.py
   ```

4. Run the application:
   ```
   cd Project
   python app.py
   ```

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
