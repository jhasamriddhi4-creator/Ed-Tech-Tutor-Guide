# AI Guru — Ed-Tech Tutor Guide

**Tagline:** Learn Smarter. Practice Better. Grow Faster.

AI Guru is a student-focused Computer Science learning prototype with Gemini-backed tutoring, MCQ quizzes, code review, notes, a study roadmap, document-grounded Q&A, browser voice features, and a saved learning library.

## Features

- **AI Tutor:** structured explanations and practice questions.
- **Quiz Generator:** configurable question count and difficulty; answers are graded on the backend.
- **Quiz History:** completed attempts are stored in SQLite with topic, difficulty, score, accuracy, and timestamp.
- **Saved Library:** save tutor answers, document-grounded answers, code reviews, notes, and roadmaps; view or delete saved items.
- **Progress Dashboard:** quiz count, average quiz accuracy, saved resources, practiced topics, accuracy history, and per-topic accuracy are derived from stored records.
- **Code Review:** educational feedback on supplied code; it does not execute code.
- **Study Roadmap and Notes:** generated on request.
- **Document-grounded Q&A:** answers from pasted text or extracted PDF text. Text-based PDFs use local text extraction; scanned/image-only PDFs fall back to Gemini OCR. Vector search is not implemented yet.
- **Voice Tutor:** records a short microphone clip, transcribes it with Gemini audio understanding, answers the question, and reads the answer aloud where browser speech synthesis is supported.
- **Student accounts:** email/password registration and sign-in, scrypt password hashing, signed HttpOnly session cookie, and server-side ownership checks for AI and saved student data.

## Technology

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js and Express
- AI provider: Google Gemini via `@google/genai`
- Persistence: SQLite via `better-sqlite3`
- Voice input: browser MediaRecorder + Gemini audio transcription; voice output: browser SpeechSynthesis

## Requirements

- A supported Node.js LTS version (Node 20 or newer recommended)
- A Google Gemini API key for AI features

## Setup

### 1. Start the backend

Open a terminal in the `server` folder:

```bash
cd server
npm install
```

Create `server/.env` and add your key. Do not commit this file:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=your_available_gemini_model
AUTH_SECRET=replace_with_a_random_secret_at_least_32_characters
PORT=5000
```

Use a model name available to your Gemini API account. Quotas and model access depend on your Google AI project. Keep AUTH_SECRET private and use a different random value for each deployment. Generate a random secret with Node.js crypto and paste it into server/.env.

Start the backend:

```bash
npm run dev
```

The API listens on `http://localhost:5000`.

### 2. Start the frontend

Open a second terminal at the repository root:

```bash
npm run dev
```

Open `http://localhost:5173`.

### 3. Verify the build

From the repository root:

```bash
npm run build
```

## Persistence details

- SQLite data is created at `server/data/ai-guru.sqlite` by default.
- Set `AI_GURU_DB_PATH` in the backend environment to use a different database path.
- The database directory and SQLite files are ignored by Git.
- Student accounts are stored in SQLite. Passwords are hashed with Node.js scrypt; raw passwords are not stored.
- Sessions use a signed, HttpOnly cookie with a seven-day expiry. Set AUTH_SECRET before starting the backend.
- Student data and AI routes require a valid session and use the account ID from that session for ownership checks.
- During registration, the current browser can migrate its existing guest quiz history and saved items into the new account.
- Before public production deployment, add rate limiting, email verification, password reset, security monitoring, and a CSRF review; use HTTPS.

## Safety guardrails

AI generation routes (Tutor, document Q&A, Quiz Generator, Code Review, Notes, and Study Roadmap) run through the same server-side input guard before a model request. The frontend runs a matching check for immediate feedback. Gemini generation requests also receive shared safety instructions through the Interactions API `system_instruction` field; voice transcription itself is transcription-only, and the resulting transcript is checked before the tutor answers it.

For local verification:

```bash
# From the repository root
npm run build

# From the server folder
npm test
```

The backend health endpoint at `http://localhost:5000/api/health` reports the active guardrail version. Restart the backend after pulling changes, then check that this version is `2026-10-25.4`.

These are deterministic pattern checks plus model instructions, not a guarantee of detecting every harmful or evasive request. Keep the API authenticated, review blocked/allowed examples, and extend tests when new bypass patterns are found.

## Intent-aware AI responses

- Casual greetings in AI Tutor receive a brief conversational response instead of a long Computer Science lesson.
- Current weather and other live-data questions receive a short limitation message rather than invented live facts or an unrelated programming lesson.
- Quiz, notes, and planner tabs require a specific study topic or goal; empty inputs and vague requests such as `random questions` no longer trigger fallback topics.
- Quiz prompts explicitly require every question to remain relevant to the exact supplied topic.
- The API health endpoint reports guardrail version `2026-10-26.1`.

## PDF RAG and live-weather intent handling

- PDF RAG accepts pasted study text, text-based PDFs, and scanned/image-only PDFs uploaded through the student interface.
- The authenticated PDF extraction endpoint accepts one PDF up to 10 MB, processes it in memory, and returns extracted text for document-grounded questions. Text-based PDFs use `pdf-parse`; if little text is found, Gemini document OCR attempts to transcribe scanned pages. Extracted text and files are not saved automatically.
- The RAG answer uses only the supplied text, treats document content as untrusted, and returns a clear message if the question or source text is missing.
- PDFs are limited to the first 120,000 extracted characters for context. OCR relies on the configured Gemini model, API quota, and document-input support; output may be incomplete for long or low-quality scans. Clear scans work best.
- Short questions such as "How is weather?" are treated as live-condition requests and are rejected by study-generation tabs. Educational topics such as weather formation and weather API design remain available.
- The API health endpoint reports version `2026-10-26.1`.

## Current limitations / next steps

- Add email verification, password reset, and authentication rate limiting before public deployment.
- Add chunking, embeddings, and semantic retrieval for large documents.
- Add chunking, embeddings, and semantic retrieval for large documents.
- Add automated integration tests and production deployment configuration.
- Improve prompt-injection protections and API rate limiting.

## Repository guide

- `src/app.js` — student UI, quiz flow, saved library, and dashboard.
- `src/services/aiGuru.js` — frontend API client.
- `src/prompts/guardrails.js` — frontend prompt helper/guardrail logic.
- `server/src/index.js` — Express app and API routes.
- `server/src/routes/ai.js` — Gemini-backed AI endpoints and quiz grading.
- `server/src/routes/student.js` — authenticated saved items and student-data endpoints.
- `server/src/routes/auth.js` — registration, sign-in, sign-out, and signed sessions.
- `server/src/services/studentStore.js` — SQLite schema and persistence operations.
- `server/data/ai-guru.sqlite` — local database created at runtime (not committed).
