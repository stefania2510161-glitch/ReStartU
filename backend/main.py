import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

try:
    import openai
except ImportError:
    openai = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
if openai and OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

# --- Data models ---

class SubjectItem(BaseModel):
    name: str
    hours_per_day: float = 1.0

class ScheduleRequest(BaseModel):
    subjects: List[SubjectItem]
    days: int
    daily_hours: float
    confidence: int
    notes: Optional[str] = ''

class NotesReviewRequest(BaseModel):
    subject: str
    notes: str

# --- Application logic ---

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
                'subject': subject.name,
                'study_minutes': session_length,
                'break_minutes': break_length,
            })
            remaining -= session_length

    return {
        'recommended_minutes': recommended_minutes,
        'available_minutes': available_minutes,
        'sessions': sessions,
        'break_policy': '25-minute focus blocks with 5-minute breaks (extended when unlocked)',
    }


def summarize_notes(notes: str):
    sentences = [sentence.strip() for sentence in notes.replace('\n', ' ').split('.') if sentence.strip()]
    sentences = [s for s in sentences if len(s) > 20]
    flashcards = []

    for idx, sentence in enumerate(sentences[:4], start=1):
        flashcards.append({
            'question': f'What is the main idea in sentence {idx}?',
            'answer': sentence,
        })

    if not flashcards:
        flashcards.append({
            'question': 'What is the key takeaway from your notes?',
            'answer': notes.strip()[:120] or 'No note content provided.',
        })

    return {
        'summary': sentences[0] if sentences else 'No clear summary found. Add more details to your notes.',
        'flashcards': flashcards,
    }


def review_notes_with_ai(subject: str, notes: str):
    if openai is None or OPENAI_API_KEY is None:
        return summarize_notes(notes)

    prompt = (
        'You are a study coach. Analyze the following notes and return valid JSON with keys: summary, flashcards. '
        'The flashcards list should contain objects with question and answer. '
        'Do not include any additional text outside the JSON structure. '
        f'Subject: {subject}\nNotes: {notes}'
    )

    try:
        response = openai.ChatCompletion.create(
            model=OPENAI_MODEL,
            messages=[
                {'role': 'system', 'content': 'You generate study flashcards and a concise summary.'},
                {'role': 'user', 'content': prompt},
            ],
            temperature=0.7,
            max_tokens=400,
        )
        content = response.choices[0].message.get('content', '')
        parsed = json.loads(content)
        return parsed
    except Exception:
        return summarize_notes(notes)

# --- API Endpoints ---

@app.get('/')
def home():
    return {'app': 'ReStartU Backend', 'status': 'Online'}

@app.post('/schedule')
def create_schedule(request: ScheduleRequest):
    return build_study_schedule(request.subjects, request.days, request.daily_hours, request.confidence)

@app.post('/review-notes')
def review_notes(request: NotesReviewRequest):
    return review_notes_with_ai(request.subject, request.notes)

@app.get('/verify-progress')
def verify(score: int, fatigue: int):
    if score >= 80 and fatigue < 7:
        return {'status': 'SUCCESS', 'next_step': 'Proceed to next topic!'}
    elif score >= 80 and fatigue >= 7:
        return {'status': 'CAUTION', 'next_step': 'Score passed, but you are tired. Take a break first.'}
    else:
        return {'status': 'RETRY', 'next_step': 'Score too low. Review the material and try again.'}

@app.get('/get-session')
def get_session(confidence: int, days_off: int, free_hours: int):
    study_mins = (confidence * 10) - (days_off * 5) + (free_hours * 8) + 20
    study_mins = max(15, round(study_mins))
    total_available_mins = free_hours * 60
    remaining_free_mins = total_available_mins - study_mins
    return {
        'recommended_minutes': study_mins,
        'remaining_free_time': max(0, remaining_free_mins),
        'message': 'ReStartU Plan Generated!'
    }


