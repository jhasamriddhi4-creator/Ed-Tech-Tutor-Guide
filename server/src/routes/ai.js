import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  generateText,
  generateStructured,
} from "../services/geminiProvider.js";
import { recordQuizAttempt } from "../services/studentStore.js";
import { requireAuth } from "./auth.js";
import { transcribeAudio } from "../services/geminiProvider.js";
import { evaluateInputGuardrails } from "../services/guardrails.js";

const router = Router();
router.use(requireAuth);

// One server-side gate for each AI generation endpoint.
// Transcription returns speech as text only; the resulting question is checked again by /tutor.
router.use((req, res, next) => {
  if (req.method !== "POST") return next();

  const path = req.path.replace(/\/+$/, "") || "/";
  if (path === "/transcribe" || /^\/quiz\/[^/]+\/submit$/.test(path)) {
    return next();
  }

  const body = req.body || {};
  let userInput;

  switch (path) {
    case "/tutor":
    case "/rag":
      userInput = body.question;
      break;
    case "/quiz":
    case "/notes":
      userInput = body.topic;
      break;
    case "/code":
      userInput = body.code;
      break;
    case "/roadmap":
      userInput = body.goal;
      break;
    default:
      return next();
  }

  const guard = evaluateInputGuardrails(userInput);
  if (!guard.allowed) {
    return res.status(400).json({
      success: false,
      code: guard.code,
      message: guard.message,
    });
  }

  return next();
});

const quizSessions = new Map();

const NOT_FOUND =
  "I could not find this information in the supplied material.";


const quizSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    topic: { type: "string" },
    difficulty: {
      type: "string",
      enum: ["easy", "medium", "hard"],
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
          },
          correctAnswer: { type: "integer" },
          explanation: { type: "string" },
        },
        required: [
          "id",
          "question",
          "options",
          "correctAnswer",
          "explanation",
        ],
      },
    },
  },
  required: [
    "title",
    "topic",
    "difficulty",
    "questions",
  ],
};

function makeQuizPrompt(topic, count, difficulty) {
  return `
You are the Quiz Generator Agent for AI Guru.

Generate a high-quality multiple-choice quiz about:
${topic}

Requirements:
- Generate exactly ${count} questions.
- Difficulty: ${difficulty}.
- Each question must have four distinct, plausible options.
- There must be exactly one correct option.
- correctAnswer is the zero-based index: 0, 1, 2 or 3.
- Include a short, accurate explanation.
- Do not repeat questions.
- Do not provide ambiguous questions.
- Do not use "all of the above" or "none of the above".
- Use accurate, independently defensible educational facts.
- Return data matching the required JSON schema.
`;
}

function validateQuiz(quiz, topic, count, difficulty) {
  if (!quiz || !Array.isArray(quiz.questions)) {
    throw new Error("Quiz generation returned invalid questions.");
  }

  const questions = quiz.questions;

  if (questions.length !== count) {
    throw new Error(
      `Expected ${count} questions, but received ${questions.length}. Please try again.`
    );
  }

  const normalized = questions.map((question, index) => {
    if (
      !Array.isArray(question.options) ||
      question.options.length !== 4 ||
      new Set(question.options).size !== 4 ||
      !Number.isInteger(question.correctAnswer) ||
      question.correctAnswer < 0 ||
      question.correctAnswer > 3 ||
      !question.question?.trim() ||
      !question.explanation?.trim()
    ) {
      throw new Error(
        `Generated question ${index + 1} failed validation. Please generate the quiz again.`
      );
    }

    return {
      id: `q${index + 1}`,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    };
  });

  return {
    title: quiz.title || `${topic} Quiz`,
    topic,
    difficulty,
    questions: normalized,
  };
}

// Submit a completed quiz.
// Correct answers are not sent to the browser before submission.
router.post("/quiz/:quizId/submit", (req, res) => {
  const session = quizSessions.get(req.params.quizId);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "Quiz not found or session expired. Generate a new quiz.",
    });
  }

  const answers = req.body?.answers;

  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return res.status(400).json({
      success: false,
      message: "Answers must be an object keyed by question ID.",
    });
  }

  let score = 0;

  const results = session.questions.map((question) => {
    const selectedIndex = answers[question.id];

    const isCorrect =
      Number.isInteger(selectedIndex) &&
      selectedIndex === question.correctAnswer;

    if (isCorrect) score++;

    return {
      questionId: question.id,
      question: question.question,
      isCorrect,
      selectedOption:
        Number.isInteger(selectedIndex) &&
        selectedIndex >= 0 &&
        selectedIndex < 4
          ? question.options[selectedIndex]
          : null,
      correctOption: question.options[question.correctAnswer],
      explanation: question.explanation,
    };
  });

  const result = {
    score,
    total: session.questions.length,
    accuracy: Math.round(
      (score / session.questions.length) * 100
    ),
    results,
  };

  if (session.userId === req.user.id) {
    try {
      recordQuizAttempt(session.userId, {
        topic: session.topic,
        difficulty: session.difficulty,
        score: result.score,
        total: result.total,
      });
    } catch (error) {
      console.error("Unable to save quiz attempt:", error);
    }
  } else {
    return res.status(403).json({
      success: false,
      message: "This quiz belongs to a different account.",
    });
  }

  // A quiz session can be submitted only once to prevent duplicate history.
  quizSessions.delete(req.params.quizId);

  return res.json({
    success: true,
    result,
  });
});

router.post("/transcribe", async (req, res) => {
  try {
    const audioBase64 = typeof req.body?.audioBase64 === "string" ? req.body.audioBase64 : "";
    const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType.split(";")[0] : "";
    const allowedMimeTypes = new Set([
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
    ]);

    if (!audioBase64 || audioBase64.length > 1_500_000 || !allowedMimeTypes.has(mimeType)) {
      return res.status(400).json({
        success: false,
        message: "Provide a short supported audio recording (WebM, Ogg, MP4, MP3 or WAV; max about 1 MB).",
      });
    }

    const audio = Buffer.from(audioBase64, "base64");
    if (!audio.length || audio.length > 1_100_000) {
      return res.status(400).json({
        success: false,
        message: "The recording is empty or too large. Try a shorter recording.",
      });
    }

    const transcript = await transcribeAudio(audio.toString("base64"), mimeType);
    if (!transcript.trim()) {
      return res.status(422).json({
        success: false,
        message: "I couldn't detect any words. Please try speaking more clearly.",
      });
    }

    return res.json({ success: true, result: { transcript: transcript.trim() } });
  } catch (error) {
    console.error("Voice transcription failed:", error);
    return res.status(502).json({
      success: false,
      message: "Voice transcription failed. You can type your question instead.",
    });
  }
});

router.post("/:task", async (req, res) => {
  try {
    const { task } = req.params;
    const body = req.body || {};

    const question = String(body.question || "").trim();
    const topic = String(body.topic || question || "").trim();
    const sourceText = String(body.sourceText || "").trim();
    const code = String(body.code || "").trim();
    const goal = String(body.goal || question || "").trim();

    if (task === "quiz") {
      if (!topic) {
        return res.status(400).json({
          success: false,
          message: "Enter a topic for the quiz.",
        });
      }

      const count = Number(body.numberOfQuestions ?? 5);
      const difficulty = body.difficulty ?? "medium";

      if (!Number.isInteger(count) || count < 1 || count > 10) {
        return res.status(400).json({
          success: false,
          message: "Question count must be between 1 and 10.",
        });
      }

      if (!["easy", "medium", "hard"].includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: "Difficulty must be easy, medium, or hard.",
        });
      }

      const generated = await generateStructured(
        makeQuizPrompt(topic, count, difficulty),
        quizSchema
      );

      const quiz = validateQuiz(
        generated,
        topic,
        count,
        difficulty
      );

      const quizId = randomUUID();

      // Keep the answer key on the backend until submission.
      if (quizSessions.size >= 100) {
        const oldestId = quizSessions.keys().next().value;
        if (oldestId) quizSessions.delete(oldestId);
      }

      quizSessions.set(quizId, {
        ...quiz,
        userId: req.user.id,
      });

      return res.json({
        success: true,
        result: {
          quizId,
          title: quiz.title,
          topic: quiz.topic,
          difficulty: quiz.difficulty,
          questions: quiz.questions.map(
            ({ id, question, options }) => ({
              id,
              question,
              options,
            })
          ),
        },
      });
    }

    let prompt;

    switch (task) {
      case "tutor":
        if (!question) {
          return res.status(400).json({
            success: false,
            message: "Enter a question for the AI Tutor.",
          });
        }

        prompt = `
You are AI Guru, a Computer Science tutor.

Explain this question in concise, well-organized Markdown.

Use these headings:
## Core Idea
## How It Works
## Example
## Common Mistakes
## Practice Question

Rules:
- Keep the total response around 400–600 words.
- Use short paragraphs and numbered steps.
- Use code blocks for code examples.
- Use tables only when they improve a comparison.
- Do not repeat the same explanation at multiple levels.
- Make the explanation appropriate for a student learning the topic.

STUDENT QUESTION:
${question}
`;
        break;

      case "rag":
        if (!question || !sourceText) {
          return res.json({
            success: true,
            result: NOT_FOUND,
          });
        }

        prompt = `
You are AI Guru, a document-grounded tutor.

Answer using ONLY the supplied material.
Do not use outside knowledge or invent facts.
If the material does not support an answer, respond exactly:
"${NOT_FOUND}"

SUPPLIED MATERIAL:
${sourceText}

STUDENT QUESTION:
${question}
`;
        break;

      case "code":
        if (!code) {
          return res.status(400).json({
            success: false,
            message: "Provide code to review.",
          });
        }

        prompt = `
You are AI Guru, an educational code reviewer.
Review the following code for likely correctness issues, edge cases,
complexity and readability. Explain your reasoning.
Do not claim code was executed unless it actually was.
Focus on helping the student learn.

CODE:
${code}
`;
        break;

      case "notes":
        if (!topic) {
          return res.status(400).json({
            success: false,
            message: "Enter a topic for the notes.",
          });
        }

        prompt = `
Create concise Computer Science study notes on:
${topic}

Include definitions, key points, an example, common mistakes,
and five useful revision questions.
Avoid inventing precise facts or citations.
`;
        break;

      case "roadmap":
        if (!goal) {
          return res.status(400).json({
            success: false,
            message: "Enter a learning goal for the planner.",
          });
        }

        prompt = `
You are AI Guru's study planning assistant.
Create a realistic, measurable learning roadmap for this goal:
${goal}

Include weekly milestones, practice activities, revision,
and ways to measure progress. State assumptions clearly.
`;
        break;

      default:
        return res.status(404).json({
          success: false,
          message: `Unknown AI task: ${task}`,
        });
    }

    const result = await generateText(prompt);

    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("AI request failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "The AI request failed.";

    return res.status(
      message.includes("GEMINI_API_KEY") ? 503 : 500
    ).json({
      success: false,
      message,
    });
  }
});

export default router;