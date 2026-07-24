import { guardPrompt, requireGrounding } from '../prompts/guardrails.js';

const llmRouter = (task) => task.includes('creative') || task.includes('roadmap') ? 'Gemini Pro' : 'OpenAI GPT';

export function askTutor(question) {
  const guard = guardPrompt(question);
  if (!guard.allowed) return guard.message;
  const model = llmRouter(question);
  return `[${model} Tutor Agent]\nBeginner: ${question} means we start with intuition and one simple example.\nIntermediate: connect the idea to algorithmic steps, trade-offs, and practice tasks.\nAdvanced: analyze complexity, edge cases, proofs, and real-world usage.\nRecommendation: revise today, attempt 5 questions, then take a 10-minute quiz.`;
}

export function ragAnswer(question, corpus) {
  const safe = guardPrompt(question);
  if (!safe.allowed) return safe.message;
  const chunks = corpus.match(/[^.]+\./g)?.slice(0, 4) ?? [corpus];
  const hit = chunks.find(chunk => question.toLowerCase().split(/\W+/).some(word => word.length > 4 && chunk.toLowerCase().includes(word)));
  return requireGrounding(hit, `[OpenAI GPT RAG]\nAnswer based only on retrieved PDF chunk:\n${hit ?? ''}\nCitation: uploaded-pdf chunk #${hit ? chunks.indexOf(hit) + 1 : 'NA'}`);
}

export function generateQuiz(topic) {
  return `[Gemini Quiz Agent]\nTopic: ${topic}\n1. MCQ: Which option best describes the core idea? A) Recall B) Analyze C) Apply D) Ignore\n2. True/False: The concept should be practiced with examples.\n3. Fill blank: Time complexity of binary search is _____.\n4. Coding: Implement the idea and test edge cases.`;
}

export function evaluateCode(code) {
  return `[OpenAI GPT Evaluator Agent]\nCorrectness: checks basic intent and sample behavior.\nComplexity: identify loops/recursion and estimate Big-O.\nImprovements: add input validation, edge-case tests, readable names.\nAcademic integrity: guidance only; no direct graded-solution dumping.\nSubmitted snippet:\n${code}`;
}

export function generateNotes(topic) {
  return `[OpenAI GPT Notes Agent]\nShort Notes: ${topic} in 5 bullets.\nRevision Notes: definition, formula/steps, example, common mistakes.\nFlashcards:\nQ: What is the key idea?\nA: Break the concept into explainable steps.`;
}

export function planRoadmap(goal) {
  return `[Gemini Planner Agent]\nGoal: ${goal}\nMonth 1: CS fundamentals and diagnostic quiz.\nMonth 2: DSA patterns and spaced repetition.\nMonth 3: Projects, GitHub, and code reviews.\nMonth 4: Mock interviews and weak-topic repair.\nMonth 5: Resume, referrals, and system design basics.\nMonth 6: Applications, revision sprints, and final portfolio demo.`;
}
