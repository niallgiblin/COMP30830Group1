import pickle
import numpy as np

with open("project/data/bike_availability_model.pkl", "rb") as file:
    model = pickle.load(file)

input_features = [
            32,
            37,
            0.70,
            1000,
            10,
            1,
        ]
input_array = np.array(input_features).reshape(1, -1)

        # Make a prediction
prediction = model.predict(input_array)
        