import numpy as np
import pandas as pd
import os

def generate_dataset(output_path="student_data.csv", n_samples=10000):
    np.random.seed(42)
    
    print(f"Generating {n_samples} student records...")
    
    # 1. confidence_level (1 to 10)
    confidence = np.random.randint(1, 11, n_samples)
    
    # 2. days_since_last_studied (0 to 180 days)
    days_off = np.random.randint(0, 181, n_samples)
    
    # 3. available_study_hours (1.0 to 8.0 hours)
    study_hours = np.random.uniform(1.0, 8.0, n_samples)
    
    # 4. fatigue_score (1 to 10)
    fatigue = np.random.randint(1, 11, n_samples)
    
    # 5. subject_difficulty (1 to 5)
    difficulty = np.random.randint(1, 6, n_samples)
    
    # Target: recommended_study_minutes
    # Logic: 
    # - Base minutes: 45
    # - More confidence -> more study mins (+5 per level)
    # - Longer break -> start with fewer study mins (-0.12 per day off) to ease back in
    # - More free hours -> more study mins (+10 per hour)
    # - Higher fatigue -> reduce study mins (-4 per score unit)
    # - Higher difficulty -> reduce study mins slightly (-3 per level) to prevent cognitive overload
    # - Random noise to make it realistic
    noise = np.random.normal(0, 8, n_samples)
    
    recommended_mins = (
        45 
        + (confidence * 5.5) 
        - (days_off * 0.12) 
        + (study_hours * 11) 
        - (fatigue * 4.5) 
        - (difficulty * 2.5) 
        + noise
    )
    
    # Clip values:
    # Cannot exceed available_study_hours * 60, and must be at least 15 minutes.
    # Also, let's limit max study minutes to 240 mins (4 hours) to prevent burnout.
    max_allowed = np.minimum(study_hours * 60, 240)
    recommended_mins = np.clip(recommended_mins, 15, max_allowed)
    recommended_mins = np.round(recommended_mins).astype(int)
    
    # Create DataFrame
    df = pd.DataFrame({
        'confidence_level': confidence,
        'days_since_last_studied': days_off,
        'available_study_hours': study_hours,
        'fatigue_score': fatigue,
        'subject_difficulty': difficulty,
        'recommended_study_minutes': recommended_mins
    })
    
    # Save to CSV
    df.to_csv(output_path, index=False)
    print(f"Dataset successfully saved to {output_path}")

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_dir, "student_data.csv")
    generate_dataset(csv_path)
