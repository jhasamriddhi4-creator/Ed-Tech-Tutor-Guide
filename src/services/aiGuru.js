const API_BASE_URL =
  globalThis.AI_GURU_API_URL || "http://localhost:5000";

async function postJSON(path, payload) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Cannot reach the AI Guru backend. Make sure the server is running on port 5000."
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The backend returned an invalid response."
    );
  }

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || `AI request failed (${response.status}).`
    );
  }

  return data.result;
}

export function askTutor(question) {
  return postJSON("/api/ai/tutor", {
    question,
  });
}

export function ragAnswer(question, sourceText) {
  return postJSON("/api/ai/rag", {
    question,
    sourceText,
  });
}

export function generateQuiz(
  topic,
  options = {}
) {
  return postJSON("/api/ai/quiz", {
    topic,
    numberOfQuestions:
      options.numberOfQuestions ?? 5,
    difficulty:
      options.difficulty ?? "medium",
  });
}

export function submitQuiz(quizId, answers) {
  return postJSON(
    `/api/ai/quiz/${encodeURIComponent(quizId)}/submit`,
    { answers }
  );
}

export function evaluateCode(code) {
  return postJSON("/api/ai/code", {
    code,
  });
}

export function generateNotes(topic) {
  return postJSON("/api/ai/notes", {
    topic,
  });
}

export function planRoadmap(goal) {
  return postJSON("/api/ai/roadmap", {
    goal,
  });
}