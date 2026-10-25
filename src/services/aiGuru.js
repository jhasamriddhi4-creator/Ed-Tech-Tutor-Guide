import { guardPrompt } from "../prompts/guardrails.js";

const API_BASE_URL =
  globalThis.AI_GURU_API_URL || "http://localhost:5000";

async function requestJSON(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
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
    throw new Error("The backend returned an invalid response.");
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || `AI request failed (${response.status}).`);
  }

  return data.result;
}

function guardAIRequest(path, payload = {}) {
  // Check the user-controlled instruction for every AI generation endpoint.
  // Document text is treated as untrusted source material, not as a new instruction.
  let input;

  switch (path) {
    case "/api/ai/tutor":
      input = payload.question;
      break;
    case "/api/ai/rag":
      input = payload.question;
      break;
    case "/api/ai/quiz":
      input = payload.topic;
      break;
    case "/api/ai/code":
      input = payload.code;
      break;
    case "/api/ai/notes":
      input = payload.topic;
      break;
    case "/api/ai/roadmap":
      input = payload.goal;
      break;
    default:
      return;
  }

  const check = guardPrompt(input);
  if (!check.allowed) {
    throw new Error(check.message);
  }
}

function postJSON(path, payload) {
  if (path.startsWith("/api/ai/")) {
    guardAIRequest(path, payload);
  }

  return requestJSON(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function getStudentPath(studentId) {
  return `/api/students/${encodeURIComponent(studentId)}`;
}

export function registerAccount(email, password, legacyStudentId = null) {
  return postJSON("/api/auth/register", { email, password, legacyStudentId });
}

export function loginAccount(email, password) {
  return postJSON("/api/auth/login", { email, password });
}

export function getCurrentAccount() {
  return requestJSON("/api/auth/me");
}

export function logoutAccount() {
  return postJSON("/api/auth/logout", {});
}

export function askTutor(question) {
  return postJSON("/api/ai/tutor", { question });
}

export function ragAnswer(question, sourceText) {
  return postJSON("/api/ai/rag", { question, sourceText });
}

export function generateQuiz(topic, options = {}) {
  return postJSON("/api/ai/quiz", {
    topic,
    numberOfQuestions: options.numberOfQuestions ?? 5,
    difficulty: options.difficulty ?? "medium",
  });
}

export function submitQuiz(quizId, answers) {
  return postJSON(
    `/api/ai/quiz/${encodeURIComponent(quizId)}/submit`,
    { answers }
  );
}

export function evaluateCode(code) {
  return postJSON("/api/ai/code", { code });
}

export function generateNotes(topic) {
  return postJSON("/api/ai/notes", { topic });
}

export function planRoadmap(goal) {
  return postJSON("/api/ai/roadmap", { goal });
}

export function getStudentData(studentId) {
  return requestJSON(getStudentPath(studentId));
}

export function saveLearningItem(studentId, item) {
  return postJSON(`${getStudentPath(studentId)}/saves`, item);
}

export function deleteLearningItem(studentId, itemId) {
  return requestJSON(
    `${getStudentPath(studentId)}/saves/${encodeURIComponent(itemId)}`,
    { method: "DELETE" }
  );
}

export function transcribeVoice(audioBase64, mimeType) {
  return postJSON("/api/ai/transcribe", { audioBase64, mimeType });
}
