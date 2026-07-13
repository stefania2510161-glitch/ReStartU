import json
import os
import uuid
from datetime import datetime
from typing import List, Optional

import joblib
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

try:
    import openai
except ImportError:  # pragma: no cover
    openai = None

load_dotenv()

app = FastAPI(title="ReStartU API", description="AI-powered study planner backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
if openai and OPENAI_API_KEY:
    try:
        openai.api_key = OPENAI_API_KEY
    except Exception:
        pass

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(CURRENT_DIR, "brain.joblib")
LOCAL_DB_PATH = os.path.join(CURRENT_DIR, "local_sessions.json")
FRONTEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "frontend"))

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
    "music": 1,
}

model = None
supabase_client = None


class SubjectItem(BaseModel):
    name: str
    hours_per_day: float = 1.0


class ScheduleRequest(BaseModel):
    subjects: List[SubjectItem]
    days: int
    daily_hours: float
    confidence: int
    notes: Optional[str] = ""


class NotesReviewRequest(BaseModel):
    subject: str
    notes: str


class SessionRequest(BaseModel):
    user_id: str = "guest"
    subject: str = "general study"
    confidence: int = 5
    days_off: int = 0
    study_hours: float = 2.0
    fatigue: int = 3


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


def get_subject_difficulty(subject: str) -> int:
    sub_lower = subject.lower().strip()
    for key, val in SUBJECT_DIFFICULTY_MAP.items():
        if key in sub_lower:
            return val
    return 3


def load_ml_model():
    global model
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            print("ML model loaded successfully.")
        except Exception as exc:  # pragma: no cover
            print(f"ML model load failed: {exc}")
            model = None
    else:
        print("No trained model found. Falling back to rule-based prediction.")
        model = None


def load_local_sessions() -> list:
    if not os.path.exists(LOCAL_DB_PATH):
        return []
    try:
        with open(LOCAL_DB_PATH, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return []


def save_local_sessions(sessions: list):
    try:
        with open(LOCAL_DB_PATH, "w", encoding="utf-8") as handle:
            json.dump(sessions, handle, indent=2)
    except Exception as exc:  # pragma: no cover
        print(f"Failed to write local sessions: {exc}")


@app.on_event("startup")
def startup_event():
    load_ml_model()


def build_study_schedule(subjects: List[SubjectItem], days: int, daily_hours: float, confidence: int):
    available_minutes = max(30, round(days * daily_hours * 60))
    confidence_bonus = max(0, confidence - 5) * 5
    recommended_minutes = min(available_minutes, max(60, round(available_minutes * 0.75 + confidence_bonus)))

    weights = [max(1.0, subject.hours_per_day) for subject in subjects]
    total_weight = sum(weights)
    subject_allocations = [round((weight / total_weight) * recommended_minutes) for weight in weights]

    sessions = []
    for subject, minutes in zip(subjects, subject_allocations):
        remaining = max(20, minutes)
        while remaining > 0:
            session_length = min(25, remaining)
            break_length = 7 if session_length == 25 else 0
            sessions.append({
                "subject": subject.name,
                "study_minutes": session_length,
                "break_minutes": break_length,
            })
            remaining -= session_length

    return {
        "recommended_minutes": recommended_minutes,
        "available_minutes": available_minutes,
        "sessions": sessions,
        "break_policy": "25-minute focus blocks with 5-minute breaks (extended when unlocked)",
    }


def summarize_notes(notes: str):
    sentences = [sentence.strip() for sentence in notes.replace("\n", " ").split(".") if sentence.strip()]
    sentences = [s for s in sentences if len(s) > 20]
    flashcards = []

    for idx, sentence in enumerate(sentences[:4], start=1):
        flashcards.append({
            "question": f"What is the main idea in sentence {idx}?",
            "answer": sentence,
        })

    if not flashcards:
        flashcards.append({
            "question": "What is the key takeaway from your notes?",
            "answer": notes.strip()[:120] or "No note content provided.",
        })

    return {
        "summary": sentences[0] if sentences else "No clear summary found. Add more details to your notes.",
        "flashcards": flashcards,
    }


def review_notes_with_ai(subject: str, notes: str):
    if openai is None or OPENAI_API_KEY is None:
        return summarize_notes(notes)

    prompt = (
        "You are a study coach. Analyze the following notes and return valid JSON with keys: summary, flashcards. "
        "The flashcards list should contain objects with question and answer. "
        "Do not include any additional text outside the JSON structure. "
        f"Subject: {subject}\nNotes: {notes}"
    )

    try:
        if hasattr(openai, "chat") and hasattr(openai.chat, "completions"):
            response = openai.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You generate study flashcards and a concise summary."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=400,
            )
            content = response.choices[0].message.content
        else:
            response = openai.ChatCompletion.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You generate study flashcards and a concise summary."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=400,
            )
            content = response.choices[0].message.get("content", "")
        parsed = json.loads(content)
        return parsed
    except Exception:
        return summarize_notes(notes)


def generate_adaptive_blocks(recommended_mins: int):
    study_blocks = []
    breaks = []

    if recommended_mins < 25:
        study_blocks = [recommended_mins]
        breaks = []
    elif recommended_mins <= 60:
        half = recommended_mins // 2
        remainder = recommended_mins % 2
        study_blocks = [half, half + remainder]
        breaks = [5]
    else:
        remaining = recommended_mins
        while remaining > 0:
            if remaining <= 35:
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

        for i in range(len(study_blocks) - 1):
            breaks.append(10 if (i + 1) % 3 == 0 else 5)

    return study_blocks, breaks


def predict_recommended_minutes(req: SessionRequest) -> int:
    difficulty = get_subject_difficulty(req.subject)
    if model is not None:
        try:
            features = np.array([[req.confidence, req.days_off, req.study_hours, req.fatigue, difficulty]])
            prediction = model.predict(features)[0]
            return int(round(float(prediction)))
        except Exception as exc:  # pragma: no cover
            print(f"Prediction failed: {exc}. Falling back to formula.")

    recommended = 45 + (req.confidence * 6) - (req.days_off * 0.15) + (req.study_hours * 11) - (req.fatigue * 4.5) - (difficulty * 2.5)
    return int(max(15, min(int(req.study_hours * 60), int(round(recommended)))))


@app.get("/")
def home():
    return FileResponse(os.path.join(FRONTEND_DIR, "chat.html"))


@app.get("/health")
def health():
    return {"app": "ReStartU Backend", "status": "Online"}


@app.post("/schedule")
def create_schedule(request: ScheduleRequest):
    return build_study_schedule(request.subjects, request.days, request.daily_hours, request.confidence)


@app.post("/review-notes")
def review_notes(request: NotesReviewRequest):
    return review_notes_with_ai(request.subject, request.notes)


@app.get("/verify-progress")
def verify(score: int, fatigue: int):
    if score >= 80 and fatigue < 7:
        return {"status": "SUCCESS", "next_step": "Proceed to next topic!"}
    if score >= 80 and fatigue >= 7:
        return {"status": "CAUTION", "next_step": "Score passed, but you are tired. Take a break first."}
    return {"status": "RETRY", "next_step": "Score too low. Review the material and try again."}


@app.get("/get-session")
def get_session(confidence: int, days_off: int, free_hours: int, subject: str = "general study", user_id: str = "guest", fatigue: int = 3):
    req = SessionRequest(
        user_id=user_id,
        subject=subject,
        confidence=confidence,
        days_off=days_off,
        study_hours=max(1.0, free_hours),
        fatigue=fatigue,
    )
    recommended_mins = predict_recommended_minutes(req)
    fatigue_alert = fatigue >= 7
    if fatigue_alert:
        recommended_mins = max(15, int(round(recommended_mins * 0.8)))

    study_blocks, breaks = generate_adaptive_blocks(recommended_mins)
    session_id = str(uuid.uuid4())
    total_available_mins = free_hours * 60
    remaining_free_mins = max(0, total_available_mins - recommended_mins)

    session_data = {
        "id": session_id,
        "user_id": user_id,
        "date": datetime.utcnow().isoformat(),
        "subject": subject,
        "confidence": confidence,
        "days_off": days_off,
        "study_hours": max(1.0, free_hours),
        "fatigue": fatigue,
        "recommended_mins": recommended_mins,
        "completed_minutes": 0,
        "is_completed": False,
    }
    local_sessions = load_local_sessions()
    local_sessions.append(session_data)
    save_local_sessions(local_sessions)

    return {
        "recommended_minutes": recommended_mins,
        "remaining_free_time": remaining_free_mins,
        "message": "ReStartU Plan Generated!",
        "study_blocks": study_blocks,
        "breaks": breaks,
        "fatigue_alert": fatigue_alert,
        "session_id": session_id,
    }


@app.post("/get-session", response_model=SessionResponse)
def create_session(req: SessionRequest):
    recommended_mins = predict_recommended_minutes(req)
    fatigue_alert = req.fatigue >= 7
    if fatigue_alert:
        recommended_mins = max(15, int(round(recommended_mins * 0.8)))

    study_blocks, breaks = generate_adaptive_blocks(recommended_mins)
    session_id = str(uuid.uuid4())
    session_data = {
        "id": session_id,
        "user_id": req.user_id,
        "date": datetime.utcnow().isoformat(),
        "subject": req.subject,
        "confidence": req.confidence,
        "days_off": req.days_off,
        "study_hours": req.study_hours,
        "fatigue": req.fatigue,
        "recommended_mins": recommended_mins,
        "completed_minutes": 0,
        "is_completed": False,
    }

    local_sessions = load_local_sessions()
    local_sessions.append(session_data)
    save_local_sessions(local_sessions)

    return SessionResponse(
        id=session_id,
        recommended_mins=recommended_mins,
        study_blocks=study_blocks,
        breaks=breaks,
        fatigue_alert=fatigue_alert,
    )


@app.get("/history/{user_id}", response_model=List[dict])
def get_history(user_id: str):
    local_sessions = load_local_sessions()
    user_sessions = [session for session in local_sessions if session.get("user_id") == user_id]
    user_sessions.sort(key=lambda session: session.get("date", ""), reverse=True)
    return user_sessions


@app.post("/complete-session")
def complete_session(req: CompleteRequest):
    local_sessions = load_local_sessions()
    updated = False
    for session in local_sessions:
        if session.get("id") == req.id:
            session["completed_minutes"] = req.completed_minutes
            session["is_completed"] = req.is_completed
            updated = True
            break

    if updated:
        save_local_sessions(local_sessions)
        return {"status": "success", "message": "Session updated."}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


