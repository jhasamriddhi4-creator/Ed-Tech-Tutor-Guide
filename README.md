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
- **Document-grounded Q&A:** answers from text supplied in the document text area. PDF file extraction and vector search are not implemented yet.
- **Voice Tutor:** browser speech recognition and text-to-speech where supported.

## Technology

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js and Express
- AI provider: Google Gemini via `@google/genai`
- Persistence: SQLite via `better-sqlite3`
- Voice: browser Web Speech APIs

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
PORT=5000
```

Use a model name available to your Gemini API account. Quotas and model access depend on your Google AI project.

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
- The prototype creates a browser-local student ID so the same browser can reload its saved items and quiz history.
- **This ID is not authentication.** The current login panel is still only a UI mockup, and the API does not yet provide secure accounts or ownership verification. Do not treat this as production-ready multi-user storage until authentication and authorization are implemented.

## Current limitations / next steps

- Add real student authentication and server-side authorization.
- Add PDF upload and text extraction.
- Add chunking, embeddings, and semantic retrieval for large documents.
- Add automated integration tests and production deployment configuration.
- Improve prompt-injection protections and API rate limiting.

## Repository guide

- `src/app.js` — student UI, quiz flow, saved library, and dashboard.
- `src/services/aiGuru.js` — frontend API client.
- `src/prompts/guardrails.js` — frontend prompt helper/guardrail logic.
- `server/src/index.js` — Express app and API routes.
- `server/src/routes/ai.js` — Gemini-backed AI endpoints and quiz grading.
- `server/src/routes/student.js` — saved items and student-data endpoints.
- `server/src/services/studentStore.js` — SQLite schema and persistence operations.
- `server/data/ai-guru.sqlite` — local database created at runtime (not committed).
