# ReStartU

ReStartU is an AI-powered study planner and productivity assistant designed to help learners build calm, effective study routines. The application combines a Python FastAPI backend with a modern frontend experience for subject planning, session generation, and notes review.

## 🧠 Project Overview

ReStartU generates adaptive study recommendations based on user inputs such as confidence, free hours, fatigue, and subject focus. It also includes notes summarization and flashcard generation, with optional OpenAI integration for improved study review.

## ✅ Features

### Built and available
- AI-backed study session estimator using rule-based fallback logic and optional trained ML model support
- `GET /get-session` endpoint to generate recommended study minutes and adaptive study/break blocks
- `POST /schedule` endpoint to build study schedules from subjects, days, daily hours, and confidence
- `POST /review-notes` endpoint to summarize notes and generate study flashcards
- `GET /verify-progress` endpoint for simple progress verification guidance based on score and fatigue
- Local session persistence in `backend/local_sessions.json`
- Frontend planner workspace with:
  - Google sign-in placeholder / local demo mode support
  - Subject collection and subject chips
  - Plan generation and timetable preview
  - History of generated plans stored in browser localStorage
  - Theme toggle and palette selection
- Simple static frontend server in `frontend/serve.py`
- `docs/` redirect page for planner access

### In progress / planned
- OpenAI-powered notes review and flashcard generation when `OPENAI_API_KEY` is configured
- ML model training pipeline from `backend/dataset.csv` to `backend/brain.joblib`
- More advanced session analytics and user-facing progress completion tracking
- Additional planner UX around session completion and history management

## 🛠️ Tech Stack

### Backend
- Python
- FastAPI
- Uvicorn (for development server)
- Pydantic
- NumPy
- Joblib
- python-dotenv
- Optional OpenAI SDK integration

### Frontend
- HTML
- CSS
- Vanilla JavaScript
- Browser localStorage for state and plan history
- Google Sign-In integration placeholder using `auth-config.js`

### Data / ML
- `backend/train_model.py` trains a linear regression model from `backend/dataset.csv`
- `backend/generate_data.py` generates synthetic training data for model experiments
- `backend/brain.joblib` holds the trained study recommendation model

## 📁 Repository Structure

- `backend/` - FastAPI app, ML training utilities, dataset and local session storage
- `frontend/` - static planner UI pages and frontend logic
- `docs/` - documentation entry page for the planner
- `archive/` - legacy or reference scripts

## 🚀 Getting Started

### 1. Backend setup

1. Create and activate a Python virtual environment in `backend/`.
2. Install backend dependencies:

```bash
cd backend
pip install -r requirements.txt
```

3. Run the API server:

```bash
uvicorn main:app --reload
```

### 2. Frontend setup

1. Serve the frontend from `frontend/`, for example:

```bash
cd frontend
python serve.py
```

2. Open the planner in your browser at `http://127.0.0.1:8001`.

### 3. Use the planner

- Open the homepage and sign in or continue in demo mode
- Add subjects and generate a study plan
- Use the onboarding profile to personalize the workspace
- View generated timetable blocks and saved plan history

## 🔧 Model Training

To train or refresh the recommendation model:

```bash
cd backend
python train_model.py
```

If you want to create new synthetic data first:

```bash
cd backend
python generate_data.py
```

## 🌐 Environment Variables

Use a `.env` file in `backend/` to configure optional AI support:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

## 📌 Notes

- The project currently supports local mode and optionally uses the OpenAI API if configured.
- Frontend state is stored in browser localStorage for plan history and theme preferences.
- Session data is stored locally in `backend/local_sessions.json`.

---

Built to help students restart their focus with calm, structured study planning.
