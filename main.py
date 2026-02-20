from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- RESTARTU LOGIC ENGINE ---

def run_gatekeeper(quiz_score: int, user_fatigue: int):
    if quiz_score >= 80 and user_fatigue < 7:
        return {"status": "SUCCESS", "next_step": "Proceed to next topic!"}
    elif quiz_score >= 80 and user_fatigue >= 7:
        return {"status": "CAUTION", "next_step": "Score passed, but you're tired. Take a 15-min break first."}
    else:
        return {"status": "RETRY", "next_step": "Score too low. Let's review the current topic."}

# --- THE API ENDPOINTS ---

@app.get("/")
def home():
    return {"app": "ReStartU Backend", "status": "Online"}

@app.get("/verify-progress")
def verify(score: int, fatigue: int):
    return run_gatekeeper(score, fatigue)

@app.get("/get-session")
def get_session(confidence: int, days_off: int, free_hours: int):
    # 1. Study Minutes Math
    study_mins = (days_off * -0.5) + (confidence * 5.0) + 40
    study_mins = max(15, round(study_mins)) 
    
    # 2. Remaining Free Time Math
    total_available_mins = free_hours * 60
    remaining_free_mins = total_available_mins - study_mins
    
    # 3. The Return (The JSON the browser sees)
    return {
        "recommended_minutes": study_mins,
        "remaining_free_time": max(0, remaining_free_mins),
        "message": "ReStartU Plan Generated!"
    }

