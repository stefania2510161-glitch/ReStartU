import os
import pandas as pd
from sklearn.linear_model import LinearRegression
import joblib

DATA_PATH = os.path.join(os.path.dirname(__file__), 'dataset.csv')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'brain.joblib')

if os.path.exists(DATA_PATH):
    data = pd.read_csv(DATA_PATH)
    X = data[['confidence', 'days_off', 'study_hours', 'fatigue', 'subject_difficulty']]
    y = data['recommended_mins']
    model = LinearRegression()
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)
    print('Model trained and saved to', MODEL_PATH)
else:
    print('No dataset.csv found. Create one first.')