import pandas as pd
import numpy as np

def generate_big_data(n=10000):
    np.random.seed(42)
    data = {
        'confidence': np.random.randint(1, 11, n),
        'days_off': np.random.randint(0, 5, n),
        'free_hours': np.random.randint(1, 10, n),
        'subject_difficulty': np.random.randint(1, 6, n),
        'user_fatigue': np.random.randint(1, 11, n)
    }
    df = pd.DataFrame(data)
    
    # Mathematical logic: Fatigue reduces study time, Difficulty increases it.
    df['recommended_minutes'] = (
        (df['confidence'] * 4) + 
        (df['subject_difficulty'] * 12) + 
        (df['free_hours'] * 8) - 
        (df['user_fatigue'] * 3) + 20
    ).clip(lower=15) # Ensures no session is less than 15 mins
    
    df.to_csv('student_data.csv', index=False)
    print("Step 1 Complete: 'student_data.csv' created.")

generate_big_data()
