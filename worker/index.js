const API_URL =
  "https://opentdb.com/api.php?amount=50&type=multiple&encode=base64";

// Return JSON responses consistently.
function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

// All visitors use the same UTC date.
function getToday() {
  return new Date().toISOString().slice(0, 10);
}

// Decode Open Trivia DB's Base64 response safely,
// including special characters and non-English text.
function decodeBase64(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(
    binary,
    character => character.charCodeAt(0)
  );

  return new TextDecoder().decode(bytes);
}

// Create a permanent identifier for each question.
async function createQuestionId(question) {
  const data = new TextEncoder().encode(
    question.trim().toLowerCase()
  );

  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Shuffle the answers randomly
function shuffleAnswers(answers, seed) {
  let value = 0;

  for (let i = 0; i < seed.length; i++) {
    value = (value * 31 + seed.charCodeAt(i)) >>> 0;
  }

  function random() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const shuffled = [...answers];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

// Fetch up to 50 new questions and save them.
async function fetchQuestions(env) {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error("Open Trivia DB request failed");
  }

  const data = await response.json();

  if (data.response_code !== 0) {
    throw new Error(
      `Open Trivia DB error: ${data.response_code}`
    );
  }

  const statements = [];

  for (const item of data.results) {
    const question = decodeBase64(item.question);
    const correctAnswer = decodeBase64(item.correct_answer);

    const incorrectAnswers = item.incorrect_answers.map(
      decodeBase64
    );

    const id = await createQuestionId(question);

    statements.push(
      env.trivia_db.prepare(`
        INSERT OR IGNORE INTO questions
        (id, category, difficulty, question,
         correct_answer, incorrect_answers)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        decodeBase64(item.category),
        decodeBase64(item.difficulty),
        question,
        correctAnswer,
        JSON.stringify(incorrectAnswers)
      )
    );
  }

  if (statements.length > 0) {
    await env.trivia_db.batch(statements);
  }
}

// Get the question already assigned to today.
async function findTodaysQuestion(env, today) {
  return env.trivia_db.prepare(`
    SELECT
      q.id,
      q.category,
      q.difficulty,
      q.question,
      q.correct_answer,
      q.incorrect_answers
    FROM daily_questions d
    JOIN questions q ON q.id = d.question_id
    WHERE d.date = ?
  `).bind(today).first();
}

// Return the public version without the correct answer.
function publicQuestion(question, today) {
  return {
    id: question.id,
    date: today,
    category: question.category,
    difficulty: question.difficulty,
    question: question.question,
    answers: shuffleAnswers(
      [
        question.correct_answer,
        ...JSON.parse(question.incorrect_answers)
      ],
      `${question.id}-${today}`
    )
  };
}

// Main daily question logic.
async function getDailyQuestion(env) {
  const today = getToday();

  // 1. Check whether today's question already exists.
  let question = await findTodaysQuestion(env, today);

  if (question) {
    return publicQuestion(question, today);
  }

  // 2. Find an unused question or replenish the pool.
  for (let attempt = 0; attempt < 5; attempt++) {
    question = await env.trivia_db.prepare(`
      SELECT q.*
      FROM questions q
      LEFT JOIN daily_questions d
        ON q.id = d.question_id
      WHERE d.question_id IS NULL
      ORDER BY RANDOM()
      LIMIT 1
    `).first();

    if (!question) {
      await fetchQuestions(env);
      continue;
    }

    // 3. Assign the question to today's date.
    // The unique constraints protect against duplicate assignments.
    const result = await env.trivia_db.prepare(`
      INSERT OR IGNORE INTO daily_questions
      (date, question_id)
      VALUES (?, ?)
    `).bind(today, question.id).run();

    // 4. If another visitor created today's question first,
    // retrieve their selection instead.
    const todaysQuestion =
      await findTodaysQuestion(env, today);

    if (todaysQuestion) {
      return publicQuestion(todaysQuestion, today);
    }

    // If the insert lost a conflict with another date,
    // try another unused question.
    if (result.meta.changes === 0) {
      continue;
    }
  }

  throw new Error("Unable to assign today's question");
}

// Check the visitor's answer.
async function checkAnswer(request, env) {
  const body = await request.json();

  const questionId = body.questionId;
  const selectedAnswer = body.answer;

  if (
    typeof questionId !== "string" ||
    typeof selectedAnswer !== "string"
  ) {
    return json({ error: "Invalid answer submission" }, 400);
  }

  const today = getToday();

  // Only check answers for today's published question.
  const question = await env.trivia_db.prepare(`
    SELECT q.correct_answer
    FROM daily_questions d
    JOIN questions q ON q.id = d.question_id
    WHERE d.date = ? AND d.question_id = ?
  `).bind(today, questionId).first();

  if (!question) {
    return json({ error: "Question not found" }, 404);
  }

  const correct =
    selectedAnswer === question.correct_answer;

  return json({
    correct,
    correctAnswer: question.correct_answer
  });
}

// Cloudflare Worker entry point.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    console.log("Available bindings:", Object.keys(env));
    console.log("DB binding exists:", !!env.trivia_db);

    try {
      if (
        url.pathname === "/api/daily-question" &&
        request.method === "GET"
      ) {
        const question = await getDailyQuestion(env);
        return json(question);
      }

      if (
        url.pathname === "/api/answer" &&
        request.method === "POST"
      ) {
        return await checkAnswer(request, env);
      }

      if (url.pathname.startsWith("/api/")) {
        return json({ error: "Not found" }, 404);
      }

      // Serve the website's HTML, CSS and JavaScript.
      return env.ASSETS.fetch(request);

    } catch (error) {
      console.error("Worker error:", error);

      return json({
        error: "Something went wrong. Please try again."
      }, 503);
    }
  }
};

