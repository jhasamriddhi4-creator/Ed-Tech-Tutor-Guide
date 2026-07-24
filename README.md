# Ed-Tech-Tutor-Guide
\ No newline at end of file
# AI Guru — AI-Powered Personalized EdTech Tutor

**Tagline:** Learn Smarter. Practice Better. Grow Faster.

AI Guru is a portfolio-ready capstone project for a Computer Science subject-focused EdTech tutor. It demonstrates an end-to-end AI application with multi-LLM routing, RAG-style PDF tutoring, AI agents, safety guardrails.

## Capstone Requirement Mapping

| Requirement | Implementation |
| --- | --- |
| End-to-end AI application | Static web app prototype with tutor, quiz, code review, notes, RAG and analytics modules |
| Real-world problem | Personalized after-class learning support for students |
| Multiple LLMs | Service router models OpenAI GPT and Google Gemini responsibilities |
| RAG | PDF text chunk retrieval with grounded answer/refusal behavior |
| Vector database | Designed for ChromaDB integration |
| AI Agent | Planner, Tutor, Quiz, Evaluator and Notes agents |
| Safety guardrails | Prompt injection, academic integrity and grounded-answer checks |
| Deployable | Static build check ready for Vercel/Netlify |


## Features

- Student login/signup UI and dashboard.
- AI Tutor explanations at beginner, intermediate and advanced levels.
- Quiz generator for MCQ, coding, fill-in-the-blank and true/false questions.
- Code evaluator for correctness, complexity and improvement suggestions.
- Notes, revision notes and flashcards.
- PDF Chat/RAG module that answers only from provided material.
- Voice tutor flow design using browser speech-to-text and text-to-speech.
- Learning roadmap planner agent.
- Progress analytics and admin snapshot.

## Tech Stack

HTML, CSS, JavaScript, Node/Express target architecture, OpenAI GPT, Google Gemini, LangChain-style orchestration, ChromaDB target vector store, upabase target auth/database and Web Speech API target voice layer.

## Getting Started

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Repository Guide

- `src/app.js` — application shell, module UI wiring and chart rendering.
- `src/services/aiGuru.js` — multi-LLM router and AI module service functions.
- `src/prompts/guardrails.js` — prompt safety and grounded-answer guardrails.
- `src/data/sampleData.js` — dashboard analytics sample data.


## Environment Variables for Full Production Version

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
GOOGLE_GEMINI_API_KEY=
CHROMA_URL=
```

## Deployment

1. Push to GitHub.
2. Import repository into Vercel.
3. Add environment variables.
4. Run `npm run build`.
5. Publish the generated app.
