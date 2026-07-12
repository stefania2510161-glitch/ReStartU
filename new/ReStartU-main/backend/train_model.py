import pandas as pd
import numpy as np
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

def train_model():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_dir, "student_data.csv")
    model_path = os.path.join(current_dir, "brain.joblib")
    
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found! Please run dataset_generator.py first.")
        return
        
    print("Loading dataset...")
    df = pd.read_csv(csv_path)
    
    # Features and target variable
    X = df[['confidence_level', 'days_since_last_studied', 'available_study_hours', 'fatigue_score', 'subject_difficulty']]
    y = df['recommended_study_minutes']
    
    # Train/test split (80-20)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training RandomForestRegressor model...")
    # Using sensible hyperparams for good performance and generalization
    model = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"Model Training Completed!")
    print(f"Mean Absolute Error (MAE): {mae:.2f} minutes")
    print(f"R-squared (R2) Score: {r2:.4f}")
    
    # Save model
    joblib.dump(model, model_path)
    print(f"Model successfully saved to {model_path}")

if __name__ == "__main__":
    train_model()
