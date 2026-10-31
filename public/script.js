const questionEl = document.getElementById("question");
const answersEl = document.getElementById("answers");
const feedbackEl = document.getElementById("feedback");

const STORAGE_KEY = "dailyTriviaAnswer";

const decode = text => {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
};

async function loadQuestion() {
  try {
    const res = await fetch("/api/daily-question");
    if (!res.ok) throw new Error();

    const q = await res.json();
    questionEl.textContent = decode(q.question);

    q.answers.forEach(answer => {
      const button = document.createElement("button");
      button.textContent = decode(answer);
      button.dataset.answer = answer;
      button.onclick = () => submitAnswer(q, answer, button);
      answersEl.appendChild(button);
    });

    // Restore this browser's answer if it has already answered today.
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");

    if (saved && saved.date === q.date && saved.questionId === q.id) {
      const button = [...answersEl.children].find(
        b => b.dataset.answer === saved.answer
      );

      if (button) await submitAnswer(q, saved.answer, button, true);
    }
  } catch (error) {
    console.error(error);
    questionEl.textContent = "Couldn't load today's question. Please refresh.";
  }
}

async function submitAnswer(q, answer, selected, restoring = false) {
  const buttons = [...answersEl.children];
  buttons.forEach(button => button.disabled = true);

  try {
    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q.id, answer })
    });

    if (!res.ok) throw new Error();

    const result = await res.json();
    const correct = decode(result.correctAnswer);

    if (result.correct) {
      selected.classList.add("correct");
      feedbackEl.textContent = "Correct.";
    } else {
      selected.classList.add("incorrect");

      buttons.forEach(button => {
        if (button.dataset.answer === result.correctAnswer) {
          button.classList.add("correct");
        }
      });

      feedbackEl.textContent = `The correct answer is ${correct}.`;
    }

    if (!restoring) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: q.date,
        questionId: q.id,
        answer
      }));
    }
  } catch (error) {
    buttons.forEach(button => button.disabled = false);
    feedbackEl.textContent = "Couldn't check your answer. Try again.";
  }
}

loadQuestion();
