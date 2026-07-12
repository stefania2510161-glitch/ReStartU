import os
import json
import uuid
import numpy as np
import joblib
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load env variables (from root or backend directory)
load_dotenv()

app = FastAPI(title="ReStartU API", description="AI-Powered Study Session Planner Backend")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Subject Difficulty Map -----------------
SUBJECT_DIFFICULTY_MAP = {
    "mathematics": 5,
    "math": 5,
    "calculus": 5,
    "physics": 5,
    "chemistry": 4,
    "computer science": 4,
    "coding": 4,
    "programming": 4,
    "biology": 3,
    "economics": 3,
    "history": 2,
    "geography": 2,
    "english": 1,
    "languages": 1,
    "art": 1,
    "music": 1
}

def get_subject_difficulty(subject: str) -> int:
    sub_lower = subject.lower().strip()
    for key, val in SUBJECT_DIFFICULTY_MAP.items():
        if key in sub_lower:
            return val
    return 3  # Default to medium difficulty

# ----------------- Load ML Model -----------------
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(CURRENT_DIR, "brain.joblib")
model = None

def load_ml_model():
    global model
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            print("ML Model 'brain.joblib' loaded successfully.")
        except Exception as e:
            print(f"Error loading ML model: {e}. Fallback to rule engine.")
    else:
        print("ML Model 'brain.joblib' not found. Will use math formulas for predictions.")

@app.on_event("startup")
def startup_event():
    load_ml_model()

# ----------------- Database Setup & Mock Fallback -----------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase_client = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client, Client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase client successfully initialized.")
    except Exception as e:
        print(f"Supabase client initialization failed: {e}. Falling back to local storage.")
else:
    print("Supabase URL or Key not set in environment. Using local JSON file database.")

LOCAL_DB_PATH = os.path.join(CURRENT_DIR, "local_sessions.json")

def load_local_sessions() -> list:
    if not os.path.exists(LOCAL_DB_PATH):
        return []
    try:
        with open(LOCAL_DB_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return []

def save_local_sessions(sessions: list):
    try:
        with open(LOCAL_DB_PATH, "w") as f:
            json.dump(sessions, f, indent=4)
    except Exception as e:
        print(f"Failed to write to local storage: {e}")

# ----------------- Study Blocks Generator Logic -----------------
def generate_adaptive_blocks(recommended_mins: int):
    """
    Splits total study minutes into study blocks and breaks based on guidelines:
    - If study time < 25 mins -> one focus block only
    - If 25-60 mins -> split intelligently
    - If > 60 mins -> use Pomodoro with breaks
    """
    study_blocks = []
    breaks = []
    
    if recommended_mins < 25:
        study_blocks = [recommended_mins]
        breaks = []
    elif recommended_mins <= 60:
        # Split into two equal or near-equal blocks
        half = recommended_mins // 2
        remainder = recommended_mins % 2
        study_blocks = [half, half + remainder]
        breaks = [5]  # Standard 5-minute break
    else:
        # > 60 mins: Pomodoro (maximum 25 mins per block)
        remaining = recommended_mins
        while remaining > 0:
            if remaining <= 35:
                # Avoid tiny trailing blocks (e.g. 5 mins). If remaining is <=35, split the remainder.
                if remaining <= 25:
                    study_blocks.append(remaining)
                    remaining = 0
                else:
                    half = remaining // 2
                    study_blocks.extend([half, remaining - half])
                    remaining = 0
            else:
                study_blocks.append(25)
                remaining -= 25
        
        # Configure breaks (length of breaks = len(study_blocks) - 1)
        for i in range(len(study_blocks) - 1):
            # Every 3rd break is a long break (10 minutes), others are 5 minutes
            if (i + 1) % 3 == 0:
                breaks.append(10)
            else:
                breaks.append(5)
                
    return study_blocks, breaks

# ----------------- Request/Response Models -----------------
class SessionRequest(BaseModel):
    user_id: str
    subject: str
    confidence: int
    days_off: int
    study_hours: float
    fatigue: int

class SessionResponse(BaseModel):
    id: str
    recommended_mins: int
    study_blocks: List[int]
    breaks: List[int]
    fatigue_alert: bool

class CompleteRequest(BaseModel):
    id: str
    completed_minutes: int
    is_completed: bool

# ----------------- Endpoints -----------------

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "ReStartU AI Planner Engine",
        "database": "Supabase" if supabase_client is not None else "Local JSON Fallback"
    }

@app.post("/get-session", response_model=SessionResponse)
def get_session(req: SessionRequest):
    # Determine difficulty level of the subject
    difficulty = get_subject_difficulty(req.subject)
    
    # 1. Predict recommended study minutes using ML Model or fallback mathematical formula
    if model is not None:
        try:
            # Inputs: confidence_level, days_since_last_studied, available_study_hours, fatigue_score, subject_difficulty
            features = np.array([[req.confidence, req.days_off, req.study_hours, req.fatigue, difficulty]])
            prediction = model.predict(features)[0]
            recommended_mins = int(round(prediction))
        except Exception as e:
            print(f"Prediction failed: {e}. Falling back to default calculation.")
            recommended_mins = 45 + (req.confidence * 6) - (req.days_off * 0.15) + (req.study_hours * 11) - (req.fatigue * 4.5) - (difficulty * 2.5)
    else:
        # Fallback formula
        recommended_mins = 45 + (req.confidence * 6) - (req.days_off * 0.15) + (req.study_hours * 11) - (req.fatigue * 4.5) - (difficulty * 2.5)

    # 2. Limit bounds
    max_allowed = int(req.study_hours * 60)
    recommended_mins = min(recommended_mins, max_allowed)
    recommended_mins = max(15, recommended_mins)
    
    # 3. Burnout Prevention (Fatigue Alert)
    fatigue_alert = req.fatigue >= 7
    if fatigue_alert:
        # Scale back the study minutes by 20% to prevent burnout
        recommended_mins = max(15, int(round(recommended_mins * 0.8)))
        
    # 4. Generate Study Blocks and Breaks
    study_blocks, breaks = generate_adaptive_blocks(recommended_mins)
    
    # 5. Save the Session
    session_id = str(uuid.uuid4())
    date_str = datetime.utcnow().isoformat()
    
    session_data = {
        "id": session_id,
        "user_id": req.user_id,
        "date": date_str,
        "subject": req.subject,
        "confidence": req.confidence,
        "days_off": req.days_off,
        "study_hours": req.study_hours,
        "fatigue": req.fatigue,
        "recommended_mins": recommended_mins,
        "completed_minutes": 0,
        "is_completed": False
    }
    
    if supabase_client is not None:
        try:
            supabase_client.table("user_sessions").insert(session_data).execute()
        except Exception as e:
            print(f"Supabase save failed: {e}. Saving locally instead.")
            # Save to local db as fallback
            local_sessions = load_local_sessions()
            local_sessions.append(session_data)
            save_local_sessions(local_sessions)
    else:
        local_sessions = load_local_sessions()
        local_sessions.append(session_data)
        save_local_sessions(local_sessions)
        
    return SessionResponse(
        id=session_id,
        recommended_mins=recommended_mins,
        study_blocks=study_blocks,
        breaks=breaks,
        fatigue_alert=fatigue_alert
    )

@app.get("/history/{user_id}", response_model=List[dict])
def get_history(user_id: str):
    if supabase_client is not None:
        try:
            res = supabase_client.table("user_sessions").select("*").eq("user_id", user_id).order("date", desc=True).execute()
            return res.data
        except Exception as e:
            print(f"Supabase query history failed: {e}. Fetching locally instead.")
            
    # Fallback to local sessions
    local_sessions = load_local_sessions()
    user_sessions = [s for s in local_sessions if s.get("user_id") == user_id]
    # Sort by date descending
    user_sessions.sort(key=lambda s: s.get("date", ""), reverse=True)
    return user_sessions

@app.post("/complete-session")
def complete_session(req: CompleteRequest):
    if supabase_client is not None:
        try:
            res = supabase_client.table("user_sessions").update({
                "completed_minutes": req.completed_minutes,
                "is_completed": req.is_completed
            }).eq("id", req.id).execute()
            # If update succeeded, return
            if len(res.data) > 0:
                return {"status": "success", "message": "Session status updated in Supabase."}
        except Exception as e:
            print(f"Supabase update failed: {e}. Updating locally instead.")
            
    # Fallback to local
    local_sessions = load_local_sessions()
    updated = False
    for session in local_sessions:
        if session.get("id") == req.id:
            session["completed_minutes"] = req.completed_minutes;
            session["is_completed"] = req.is_completed
            updated = True
            break
            
    if updated:
        save_local_sessions(local_sessions)
        return {"status": "success", "message": "Session status updated in local storage."}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Session with id {req.id} not found."
        )
