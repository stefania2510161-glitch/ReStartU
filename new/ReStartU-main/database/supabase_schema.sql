-- Create the user_sessions table in Supabase
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT now() NOT NULL,
    subject TEXT NOT NULL,
    confidence INT NOT NULL,
    days_off INT NOT NULL,
    study_hours NUMERIC NOT NULL,
    fatigue INT NOT NULL,
    recommended_mins INT NOT NULL,
    completed_minutes INT DEFAULT 0 NOT NULL,
    is_completed BOOLEAN DEFAULT false NOT NULL
);

-- Index for retrieving history quickly per user
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
