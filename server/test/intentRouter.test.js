import test from "node:test";
import assert from "node:assert/strict";
import {
  isLiveWeatherRequest,
  isSimpleGreeting,
  routeStudentRequest,
} from "../src/services/intentRouter.js";

test("AI Tutor answers casual greetings briefly without generating a lesson", () => {
  assert.equal(isSimpleGreeting("How are you doing?"), true);
  const result = routeStudentRequest("tutor", { question: "How are you doing?" });
  assert.equal(result.action, "reply");
  assert.match(result.result, /doing well|ready to help/i);
});

test("AI Tutor responds honestly to a request for current weather", () => {
  assert.equal(isLiveWeatherRequest("How is the weather today?"), true);
  const result = routeStudentRequest("tutor", { question: "How is the weather today?" });
  assert.equal(result.action, "reply");
  assert.match(result.result, /can’t check today’s live weather/i);
});

test("weather API questions remain valid educational questions", () => {
  assert.equal(isLiveWeatherRequest("How do I build a weather API client?"), false);
  assert.equal(
    routeStudentRequest("tutor", { question: "How do I build a weather API client?" }).action,
    "continue"
  );
});

test("ordinary CS questions are passed to the tutor", () => {
  assert.equal(
    routeStudentRequest("tutor", { question: "Explain binary search with an example." }).action,
    "continue"
  );
});

test("quiz refuses vague or random topic input instead of inventing a topic", () => {
  for (const topic of ["", "random questions", "anything", "surprise me", "quiz"]) {
    assert.equal(routeStudentRequest("quiz", { topic }).action, "reject", topic);
  }
});

test("quiz accepts a specific study topic", () => {
  assert.equal(routeStudentRequest("quiz", { topic: "Data Structures" }).action, "continue");
});

test("notes and planner require a specific topic or goal", () => {
  assert.equal(routeStudentRequest("notes", { topic: "" }).action, "reject");
  assert.equal(routeStudentRequest("notes", { topic: "Operating Systems" }).action, "continue");
  assert.equal(routeStudentRequest("roadmap", { goal: "" }).action, "reject");
  assert.equal(
    routeStudentRequest("roadmap", { goal: "Prepare for a software engineering internship" }).action,
    "continue"
  );
});

test("study-generation tabs do not generate content from greeting or live-weather requests", () => {
  for (const task of ["quiz", "notes", "roadmap"]) {
    assert.equal(routeStudentRequest(task, { topic: "How is the weather today?" }).action, "reject", task);
    assert.equal(routeStudentRequest(task, { topic: "Hello, how are you?" }).action, "reject", task);
  }
});

test("tutor does not mistake current weather for a coding question", () => {
  const result = routeStudentRequest("tutor", { question: "How is the weather?" });
  assert.equal(result.action, "reply");
  assert.match(result.result, /can’t check today’s live weather/i);
});


test("weather API and weather app design questions remain educational", () => {
  assert.equal(isLiveWeatherRequest("What is a weather API?"), false);
  assert.equal(isLiveWeatherRequest("Explain how a weather app retrieves forecasts."), false);
});

test("rejects vague random-quiz wording when no real topic is named", () => {
  for (const topic of [
    "Make a random quiz for random questions",
    "Generate some random questions",
    "Make me a quiz about anything",
  ]) {
    assert.equal(routeStudentRequest("quiz", { topic }).action, "reject", topic);
  }
});

test("allows a random-style quiz when a real topic is specified", () => {
  assert.equal(
    routeStudentRequest("quiz", { topic: "Make a random quiz about Data Structures" }).action,
    "continue"
  );
});


test("short weather questions are treated as live-data requests in study tabs", () => {
  for (const question of ["How is weather", "How is the weather?", "What's the weather?", "How is the weather today?"]) {
    assert.equal(isLiveWeatherRequest(question), true, question);
    assert.equal(routeStudentRequest("notes", { topic: question }).action, "reject", question);
    assert.equal(routeStudentRequest("quiz", { topic: question }).action, "reject", question);
    assert.equal(routeStudentRequest("roadmap", { goal: question }).action, "reject", question);
  }
});

test("weather education topics are not mistaken for live weather", () => {
  for (const topic of [
    "Weather formation",
    "How weather patterns form",
    "Weather and climate",
    "Weather API",
    "How do I build a weather API client?",
    "Explain a weather forecasting application",
  ]) {
    assert.equal(isLiveWeatherRequest(topic), false, topic);
    assert.equal(routeStudentRequest("notes", { topic }).action, "continue", topic);
    assert.equal(routeStudentRequest("quiz", { topic }).action, "continue", topic);
  }
});

