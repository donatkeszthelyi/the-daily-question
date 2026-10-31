CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    question TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    incorrect_answers TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_questions (
    date TEXT PRIMARY KEY,
    question_id TEXT NOT NULL UNIQUE,
    FOREIGN KEY (question_id) REFERENCES questions(id)
);

