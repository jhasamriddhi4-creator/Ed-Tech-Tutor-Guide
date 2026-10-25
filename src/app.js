import {
  askTutor,
  evaluateCode,
  generateNotes,
  generateQuiz,
  planRoadmap,
  ragAnswer,
  submitQuiz,
  getStudentData,
  saveLearningItem,
  deleteLearningItem,
  registerAccount,
  loginAccount,
  getCurrentAccount,
  logoutAccount,
  transcribeVoice,
} from "./services/aiGuru.js?v=guardrails-all-tabs-20261025-2";
import { guardPrompt } from "./prompts/guardrails.js";

const tabs = {
  tutor: "🎓 AI Tutor",
  rag: "📄 PDF RAG",
  quiz: "✨ Quiz",
  code: "💻 Code Review",
  notes: "🧠 Notes",
  roadmap: "🛣️ Planner Agent",
  voice: "🎙️ Voice Tutor",
  library: "📚 Saved Library"
};

const prompt = document.querySelector("#prompt");
const pdf = document.querySelector("#pdf");
const output = document.querySelector("#output");
const title = document.querySelector("#title");
const quizOptions = document.querySelector("#quizOptions");
const quizCount = document.querySelector("#quizCount");
const quizDifficulty = document.querySelector("#quizDifficulty");

let currentUser = null;
let studentId = null;
let studentData = { savedItems: [], quizAttempts: [] };
let lastGeneratedContent = "";
let lastGeneratedType = "";

// Call this whenever the active tab changes.
function updateQuizOptions() {
  if (quizOptions) {
    quizOptions.hidden = active !== "quiz";
  }
}

async function runQuiz() {
  const parsedCount = Number.parseInt(quizCount?.value ?? "5", 10);
  const count = Math.min(
    10,
    Math.max(1, Number.isFinite(parsedCount) ? parsedCount : 5)
  );

  const selectedDifficulty = quizDifficulty?.value || "medium";
  const difficulty = ["easy", "medium", "hard"].includes(selectedDifficulty)
    ? selectedDifficulty
    : "medium";

  if (quizCount) {
    quizCount.value = String(count);
  }

  return generateQuiz(
    prompt.value.trim() || "Binary Search",
    {
      numberOfQuestions: count,
      difficulty,
      studentId
    }
  );
}
const DEFAULT_TUTOR_PROMPT =
  "Explain Binary Search at beginner, intermediate and advanced levels.";

let active = "tutor";

prompt.value = DEFAULT_TUTOR_PROMPT;

pdf.value =
  "Operating systems manage processes, memory, files, and devices. " +
  "A process is a program in execution. Scheduling decides which process runs next.";

// These cards will be connected to real learning analytics later.
function renderCards() {
  const attempts = studentData.quizAttempts || [];
  const savedItems = studentData.savedItems || [];
  const averageAccuracy = attempts.length
    ? Math.round(attempts.reduce((sum, item) => sum + item.accuracy, 0) / attempts.length)
    : 0;
  const practicedTopics = new Set(attempts.map((item) => item.topic)).size;

  const cards = [
    ["Quizzes completed", String(attempts.length)],
    ["Average quiz accuracy", `${averageAccuracy}%`],
    ["Saved learning resources", String(savedItems.length)],
    ["Topics practiced", String(practicedTopics)],
  ];

  document.querySelector("#cards").innerHTML = cards
    .map(
      ([key, value]) =>
        `<article><span>${key}</span><strong>${value}</strong></article>`
    )
    .join("");
}

function renderDashboardCharts() {
  const attempts = [...(studentData.quizAttempts || [])]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-7)
    .map((item) => ({
      week: new Date(item.createdAt).toLocaleDateString(),
      accuracy: item.accuracy,
    }));

  const topicScores = new Map();
  for (const attempt of studentData.quizAttempts || []) {
    const current = topicScores.get(attempt.topic) || { total: 0, count: 0 };
    current.total += attempt.accuracy;
    current.count += 1;
    topicScores.set(attempt.topic, current);
  }

  const topics = [...topicScores.entries()].map(([name, values]) => ({
    name,
    score: Math.round(values.total / values.count),
  }));

  chart("#lineChart", attempts, "accuracy");
  chart("#barChart", topics, "score");

  if (!attempts.length) {
    document.querySelector("#lineChart").innerHTML =
      '<p class="empty-state">Complete a quiz to see your progress here.</p>';
  }

  if (!topics.length) {
    document.querySelector("#barChart").innerHTML =
      '<p class="empty-state">Topic mastery will appear after your first quiz.</p>';
  }
}

async function loadStudentData() {
  if (!studentId) return;
  try {
    studentData = await getStudentData(studentId);
    renderCards();
    renderDashboardCharts();
  } catch (error) {
    console.warn("Student progress could not be loaded:", error);
  }
}

async function saveCurrentResult() {
  if (!lastGeneratedContent || !lastGeneratedType) return;

  const saveButton = document.querySelector("#saveCurrentResult");
  const status = document.querySelector("#saveCurrentStatus");
  if (saveButton) saveButton.disabled = true;
  if (status) status.textContent = "Saving...";

  try {
    await saveLearningItem(studentId, {
      title: (prompt.value.trim() || `${lastGeneratedType} result`).slice(0, 160),
      type: lastGeneratedType,
      content: lastGeneratedContent,
    });
    await loadStudentData();
    if (status) status.textContent = "Saved to your library.";
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : "Unable to save this result.";
    if (saveButton) saveButton.disabled = false;
  }
}

function addSaveResultControl(result) {
  const allowedTypes = ["tutor", "rag", "code", "notes", "roadmap"];
  if (!allowedTypes.includes(active)) return;

  lastGeneratedType = active;
  lastGeneratedContent = typeof result === "string"
    ? result
    : JSON.stringify(result, null, 2);

  const controls = element("div", "save-controls");
  const button = element("button", "quiz-submit", "☆ Save to My Library");
  button.id = "saveCurrentResult";
  const status = element("p", "quiz-status", "");
  status.id = "saveCurrentStatus";
  button.addEventListener("click", saveCurrentResult);
  controls.append(button, status);
  output.append(controls);
}

function renderSavedLibrary() {
  output.replaceChildren();
  const wrapper = element("div", "library-panel");
  wrapper.append(element("h3", "quiz-heading", "📚 My Saved Library"));

  const items = studentData.savedItems || [];
  if (!items.length) {
    wrapper.append(element("p", "empty-state", "You haven't saved anything yet. Generate a tutor answer, notes, code review, roadmap, or document-grounded answer, then choose Save to My Library."));
    output.append(wrapper);
    return;
  }

  items.forEach((item) => {
    const card = element("article", "saved-item");
    card.append(
      element("h3", "saved-item-title", item.title),
      element("p", "quiz-subtitle", `${item.type.toUpperCase()} · ${new Date(item.createdAt).toLocaleString()}`)
    );

    const content = element("div", "ai-response");
    content.innerHTML = renderMarkdown(item.content);

    const remove = element("button", "quiz-submit voice-secondary", "Delete");
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      try {
        await deleteLearningItem(studentId, item.id);
        await loadStudentData();
        renderSavedLibrary();
      } catch (error) {
        remove.disabled = false;
        window.alert(error instanceof Error ? error.message : "Unable to delete saved item.");
      }
    });

    card.append(content, remove);
    wrapper.append(card);
  });

  output.append(wrapper);
}
function renderTabs() {
  const tabsContainer = document.querySelector("#tabs");

  tabsContainer.innerHTML = Object.entries(tabs)
    .map(
      ([key, label]) =>
        `<button data-tab="${key}" class="${active === key ? "active" : ""}">${label}</button>`
    )
    .join("");

  tabsContainer.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      active = button.dataset.tab;
      tabsContainer.querySelectorAll("[data-tab]").forEach((tabButton) => {
        tabButton.classList.toggle("active", tabButton === button);
      });
      title.textContent = tabs[active];
      pdf.hidden = active !== "rag";
      updateQuizOptions();

      if (active === "voice") {
        renderVoiceUI();
        return;
      }

      if (active === "library") {
        renderSavedLibrary();
        return;
      }

      output.textContent =
        `Selected ${tabs[active]}. Enter your input and click Run AI Guru.`;
    });
  });

  updateQuizOptions();
}
function element(tag, className, text) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;

  return node;
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMarkdown(value) {
  // Support Markdown that has been escaped with backslashes.
  const normalized = String(value).replace(
    /\\([*_`#$])/g,
    "$1"
  );

  let text = escapeHTML(normalized);

  // Protect inline code from other Markdown replacements.
  const codeParts = [];

  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const index = codeParts.push(code) - 1;
    return `\u0000INLINECODE${index}\u0000`;
  });

  text = text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  text = text.replace(
    /\u0000INLINECODE(\d+)\u0000/g,
    (_, index) => `<code>${codeParts[Number(index)]}</code>`
  );

  return text;
}

function renderMarkdown(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const blocks = [];

  let paragraph = [];
  let listItems = [];
  let listType = null;
  let inCodeBlock = false;
  let codeLines = [];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push(
        `<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`
      );
      paragraph = [];
    }
  }

  function flushList() {
    if (listItems.length && listType) {
      blocks.push(
        `<${listType}>${listItems.join("")}</${listType}>`
      );
    }

    listItems = [];
    listType = null;
  }

  function flushTextBlocks() {
    flushParagraph();
    flushList();
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push(
          `<pre><code>${escapeHTML(codeLines.join("\n"))}</code></pre>`
        );

        codeLines = [];
        inCodeBlock = false;
      } else {
        flushTextBlocks();
        inCodeBlock = true;
      }

      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushTextBlocks();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      flushTextBlocks();

      const level = heading[1].length;

      blocks.push(
        `<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`
      );

      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      flushTextBlocks();
      blocks.push("<hr>");
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);

    if (quote) {
      flushTextBlocks();

      blocks.push(
        `<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`
      );

      continue;
    }

    const list = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);

    if (list) {
      flushParagraph();

      const type = list[2] ? "ol" : "ul";

      if (listType !== type) {
        flushList();
        listType = type;
      }

      listItems.push(
        `<li>${renderInlineMarkdown(list[3])}</li>`
      );

      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushTextBlocks();

  if (inCodeBlock) {
    blocks.push(
      `<pre><code>${escapeHTML(codeLines.join("\n"))}</code></pre>`
    );
  }

  return blocks.join("\n");
}

let currentRecorder = null;
let currentStream = null;
let recordingTimeout = null;
let lastTutorAnswer = "";
let lastVoiceQuestion = "";

function setVoiceStatus(message) {
  const status = document.querySelector("#voiceStatus");
  if (status) status.textContent = message;
}

function speakAnswer(text) {
  if (!("speechSynthesis" in window)) {
    setVoiceStatus("Speech output is unavailable in this browser. You can still read the answer below.");
    return;
  }

  window.speechSynthesis.cancel();
  const spokenText = String(text)
    .replace(/```[\s\S]*?```/g, "Code example omitted.")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/[#*_\`>|]/g, " ")
    .replace(/[{}\\\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onstart = () => setVoiceStatus("AI Guru is speaking...");
  utterance.onend = () => setVoiceStatus("Answer finished. Record another question when ready.");
  utterance.onerror = () => setVoiceStatus("Speech output failed. You can still read the answer below.");
  window.speechSynthesis.speak(utterance);
}

async function answerVoiceQuestion(question) {
  const normalizedQuestion = String(question ?? "").trim();
  const answerBox = document.querySelector("#voiceAnswer");
  const saveButton = document.querySelector("#saveVoiceAnswer");
  const saveStatus = document.querySelector("#saveVoiceStatus");

  if (!normalizedQuestion) {
    setVoiceStatus("I couldn't detect a question. Please try again or type one.");
    return;
  }

  // Run the same client-side guard before sending a transcribed voice question.
  // The backend independently enforces its own guardrails as the source of truth.
  const localGuard = guardPrompt(normalizedQuestion);
  if (!localGuard.allowed) {
    lastTutorAnswer = "";
    lastVoiceQuestion = "";
    if (answerBox) answerBox.innerHTML = renderMarkdown(localGuard.message);
    if (saveButton) {
      saveButton.hidden = false;
      saveButton.disabled = true;
      saveButton.textContent = "☆ Save to My Library";
    }
    if (saveStatus) saveStatus.textContent = "Blocked requests cannot be saved.";
    setVoiceStatus(localGuard.message);
    speakAnswer(localGuard.message);
    return;
  }

  setVoiceStatus("AI Guru is thinking...");
  try {
    const answer = await askTutor(normalizedQuestion);
    lastTutorAnswer = answer;
    lastVoiceQuestion = normalizedQuestion;

    if (answerBox) answerBox.innerHTML = renderMarkdown(answer);
    if (saveButton) {
      saveButton.hidden = false;
      saveButton.disabled = false;
      saveButton.textContent = "☆ Save to My Library";
    }
    if (saveStatus) saveStatus.textContent = "";

    setVoiceStatus("Answer ready. Reading it aloud...");
    speakAnswer(answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to contact AI Guru.";
    const isGuardrailBlock = message.toLowerCase().includes("safety guardrail");

    if (isGuardrailBlock) {
      lastTutorAnswer = "";
      lastVoiceQuestion = "";
      if (answerBox) answerBox.innerHTML = renderMarkdown(message);
      if (saveButton) {
        saveButton.hidden = false;
        saveButton.disabled = true;
        saveButton.textContent = "☆ Save to My Library";
      }
      if (saveStatus) saveStatus.textContent = "Blocked requests cannot be saved.";
      setVoiceStatus(message);
      speakAnswer(message);
      return;
    }

    setVoiceStatus(message);
    if (answerBox) {
      answerBox.textContent = message;
    }
    if (saveButton) {
      saveButton.hidden = false;
      saveButton.disabled = !lastTutorAnswer || !lastVoiceQuestion;
    }
  }
}
function stopVoiceTracks() {
  if (recordingTimeout) {
    clearTimeout(recordingTimeout);
    recordingTimeout = null;
  }
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }
  currentRecorder = null;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || "");
      const comma = dataUrl.indexOf(",");
      if (comma < 0) {
        reject(new Error("Unable to read the audio recording."));
        return;
      }
      resolve(dataUrl.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error("Unable to read the audio recording."));
    reader.readAsDataURL(blob);
  });
}

async function transcribeRecording(blob) {
  if (!blob || blob.size === 0) {
    setVoiceStatus("The recording was empty. Please try again.");
    return;
  }
  if (blob.size > 1_000_000) {
    setVoiceStatus("That recording was too large. Please try a shorter question.");
    return;
  }

  try {
    setVoiceStatus("Transcribing your recording...");
    const audioBase64 = await blobToBase64(blob);
    const mimeType = (blob.type || "audio/webm").split(";")[0];
    const result = await transcribeVoice(audioBase64, mimeType);
    const transcript = result?.transcript?.trim();

    if (!transcript) {
      setVoiceStatus("I couldn't detect words. Please try again or type your question.");
      return;
    }

    prompt.value = transcript;
    setVoiceStatus(`I heard: “${transcript}”`);
    await answerVoiceQuestion(transcript);
  } catch (error) {
    setVoiceStatus(
      error instanceof Error
        ? `${error.message} You can also type your question in the input above.`
        : "Transcription failed. You can type your question instead."
    );
  }
}

function renderVoiceUI(answer = lastTutorAnswer) {
  output.replaceChildren();
  const wrapper = element("div", "voice-panel");
  wrapper.append(
    element("h3", "quiz-heading", "🎙️ Voice Tutor"),
    element(
      "p",
      "quiz-subtitle",
      "Record a short question. AI Guru transcribes it with Gemini, answers it, and can read the answer aloud."
    )
  );

  const controls = element("div", "voice-controls");
  const startButton = element("button", "quiz-submit", "🎙️ Record question");
  const stopButton = element("button", "quiz-submit voice-secondary", "Stop recording");
  const repeatButton = element("button", "quiz-submit voice-secondary", "🔊 Read answer again");
  const stopSpeechButton = element("button", "quiz-submit voice-secondary", "Stop speaking");
  stopButton.disabled = true;

  const status = element("p", "quiz-status", "Click Record question and allow microphone access.");
  status.id = "voiceStatus";
  const answerBox = element("div", "ai-response");
  answerBox.id = "voiceAnswer";
  answerBox.innerHTML = renderMarkdown(answer);

  const saveControls = element("div", "save-controls");
  const saveButton = element("button", "quiz-submit", "☆ Save to My Library");
  saveButton.type = "button";
  saveButton.id = "saveVoiceAnswer";
  saveButton.hidden = false;
  saveButton.disabled = !(answer && lastVoiceQuestion);
  const saveStatus = element("p", "quiz-status", "");
  saveStatus.id = "saveVoiceStatus";
  saveStatus.textContent = saveButton.disabled
    ? "Generate a voice answer to enable saving."
    : "";
  saveControls.append(saveButton, saveStatus);

  controls.append(startButton, stopButton, repeatButton, stopSpeechButton);
  wrapper.append(controls, status, answerBox, saveControls);
  output.append(wrapper);

  saveButton.addEventListener("click", async () => {
    if (!lastTutorAnswer || !lastVoiceQuestion) {
      saveStatus.textContent = "Ask a voice question before saving an answer.";
      return;
    }

    if (!currentUser || !studentId) {
      saveStatus.textContent = "Please sign in before saving learning material.";
      return;
    }

    saveButton.disabled = true;
    saveStatus.textContent = "Saving voice question and answer...";

    try {
      const titleText = `Voice Tutor: ${lastVoiceQuestion.trim() || "Tutor answer"}`.slice(0, 160);
      const content = `## Voice Tutor Question\n\n${lastVoiceQuestion}\n\n## AI Tutor Answer\n\n${lastTutorAnswer}`;

      await saveLearningItem(studentId, {
        title: titleText,
        type: "tutor",
        content,
      });

      await loadStudentData();
      saveButton.textContent = "✓ Saved to My Library";
      saveStatus.textContent = "Saved. Open the Saved Library tab to view it.";
    } catch (error) {
      saveButton.disabled = false;
      saveStatus.textContent = error instanceof Error
        ? error.message
        : "Unable to save the voice answer. Please try again.";
    }
  });

  startButton.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceStatus("Audio recording is not supported in this browser. Use an up-to-date Chrome or Edge browser, or type your question above.");
      return;
    }

    if (currentRecorder && currentRecorder.state !== "inactive") {
      setVoiceStatus("A recording is already in progress.");
      return;
    }

    try {
      setVoiceStatus("Requesting microphone access...");
      currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const preferredType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
      currentRecorder = preferredType
        ? new MediaRecorder(currentStream, { mimeType: preferredType })
        : new MediaRecorder(currentStream);

      const recorder = currentRecorder;
      const chunks = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      });

      recorder.addEventListener("stop", async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        stopVoiceTracks();
        startButton.disabled = false;
        stopButton.disabled = true;
        await transcribeRecording(blob);
      }, { once: true });

      recorder.addEventListener("error", () => {
        stopVoiceTracks();
        startButton.disabled = false;
        stopButton.disabled = true;
        setVoiceStatus("Microphone recording failed. Check your microphone permissions and try again.");
      }, { once: true });

      recorder.start();
      startButton.disabled = true;
      stopButton.disabled = false;
      setVoiceStatus("Recording… speak your question now. Recording stops automatically after 12 seconds.");
      recordingTimeout = setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, 12_000);
    } catch (error) {
      stopVoiceTracks();
      startButton.disabled = false;
      stopButton.disabled = true;
      const message = error?.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access in your browser's site settings."
        : error?.name === "NotFoundError"
          ? "No microphone was found. Connect a microphone and try again."
          : "Unable to start recording. Check microphone access and try again.";
      setVoiceStatus(message);
    }
  });

  stopButton.addEventListener("click", () => {
    if (currentRecorder && currentRecorder.state !== "inactive") {
      currentRecorder.stop();
      setVoiceStatus("Finishing your recording...");
    }
  });

  repeatButton.addEventListener("click", () => {
    if (lastTutorAnswer) speakAnswer(lastTutorAnswer);
    else setVoiceStatus("Ask a question before replaying an answer.");
  });

  stopSpeechButton.addEventListener("click", () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setVoiceStatus("Speech stopped.");
  });
}

// Render selectable MCQs without exposing the answer key.
function renderQuizUI(quiz) {
  output.replaceChildren();

  const wrapper = element("div", "quiz-panel");
  wrapper.append(
    element("h3", "quiz-heading", quiz.title),
    element(
      "p",
      "quiz-subtitle",
      `Topic: ${quiz.topic} · Difficulty: ${quiz.difficulty}`
    )
  );

  const form = element("form", "quiz-form");

  quiz.questions.forEach((question, questionIndex) => {
    const fieldset = element("fieldset", "quiz-question");

    fieldset.append(
      element(
        "legend",
        "quiz-question-title",
        `${questionIndex + 1}. ${question.question}`
      )
    );

    question.options.forEach((option, optionIndex) => {
      const label = element("label", "quiz-option");
      const radio = document.createElement("input");

      radio.type = "radio";
      radio.name = question.id;
      radio.value = String(optionIndex);
      radio.required = true;

      label.append(
        radio,
        element("span", "", option)
      );

      fieldset.append(label);
    });

    form.append(fieldset);
  });

  const submitButton = element(
    "button",
    "quiz-submit",
    "Submit Quiz"
  );

  submitButton.type = "submit";

  const status = element("p", "quiz-status", "");

  form.append(submitButton, status);
  wrapper.append(form);
  output.append(wrapper);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const answers = {};

    for (const question of quiz.questions) {
      const selected = formData.get(question.id);

      if (selected === null) {
        status.textContent =
          "Please answer every question before submitting.";
        return;
      }

      answers[question.id] = Number(selected);
    }

    submitButton.disabled = true;
    status.textContent = "Checking your answers...";

    try {
      const result = await submitQuiz(
        quiz.quizId,
        answers
      );

      await loadStudentData();
      renderQuizResults(result);
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Quiz submission failed.";

      submitButton.disabled = false;
    }
  });
}

function renderQuizResults(result) {
  output.replaceChildren();

  const wrapper = element("div", "quiz-panel");

  wrapper.append(
    element("h3", "quiz-heading", "Quiz Complete"),
    element(
      "p",
      "quiz-score",
      `Score: ${result.score} / ${result.total}`
    ),
    element(
      "p",
      "quiz-score",
      `Accuracy: ${result.accuracy}%`
    )
  );

  result.results.forEach((item, index) => {
    const card = element("article", "quiz-review");

    card.append(
      element("h4", "", `${index + 1}. ${item.question}`),
      element(
        item.isCorrect ? "p" : "p",
        item.isCorrect ? "quiz-correct" : "quiz-incorrect",
        item.isCorrect ? "Correct" : "Review this answer"
      ),
      element(
        "p",
        "",
        `Your answer: ${item.selectedOption ?? "Not answered"}`
      ),
      element(
        "p",
        "",
        `Correct answer: ${item.correctOption}`
      ),
      element("p", "", `Explanation: ${item.explanation}`)
    );

    wrapper.append(card);
  });

  const retry = element(
    "button",
    "quiz-submit",
    "Generate Another Quiz"
  );

  retry.addEventListener("click", () => {
    run();
  });

  wrapper.append(retry);
  output.append(wrapper);
}

function chart(selector, data, key) {
  document.querySelector(selector).innerHTML =
    data
      .map(
        (item) =>
          `<div><span>${escapeHTML(item.name || item.week)}</span>` +
          `<b style="height:${Number(item[key]) * 2}px"></b>` +
          `<em>${Number(item[key])}</em></div>`
      )
      .join("");
}

async function run() {
  if (!currentUser) {
    showAuthMessage("Please sign in to use AI Guru.");
    return;
  }

  if (active === "library") {
    renderSavedLibrary();
    return;
  }

  if (active === "voice") {
  const spokenQuestion = prompt.value.trim();

  if (!spokenQuestion) {
    renderVoiceUI();
    setVoiceStatus("Enter a question or click Start speaking.");
    return;
  }

  await answerVoiceQuestion(spokenQuestion);
  return;
}

  output.textContent = "Connecting to AI Guru...";

  const actions = {
    tutor: () => askTutor(prompt.value),

    rag: () => ragAnswer(prompt.value, pdf.value),

    quiz: () => runQuiz(),

    code: () =>
      evaluateCode(
        prompt.value.trim() ||
          "function add(a, b) { return a + b; }"
      ),

    notes: () =>
      generateNotes(
        prompt.value.trim() || "Machine Learning"
      ),

    roadmap: () =>
      planRoadmap(
        prompt.value.trim() ||
          "Prepare for a software engineering internship in six months"
      ),

  };

  try {
    const result = await actions[active]();

    if (active === "quiz" && result?.questions?.length) {
      renderQuizUI(result);
      return;
    }

    output.innerHTML = renderMarkdown(
      typeof result === "string"
        ? result
        : JSON.stringify(result, null, 2)
    );
    addSaveResultControl(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("AI Guru request failed:", error);

    if (message.toLowerCase().includes("safety guardrail")) {
      output.innerHTML = renderMarkdown(message);
      return;
    }

    output.textContent = `Request failed: ${message}`;
  }
}


const authForm = document.querySelector("#authForm");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authSubmit = document.querySelector("#authSubmit");
const authModeToggle = document.querySelector("#authModeToggle");
const authTitle = document.querySelector("#authTitle");
const authSubtitle = document.querySelector("#authSubtitle");
const authMessage = document.querySelector("#authMessage");
const authGate = document.querySelector("#authGate");
const appContent = document.querySelector("#appContent");
const accountBar = document.querySelector("#accountBar");
const accountEmail = document.querySelector("#accountEmail");
const logoutButton = document.querySelector("#logoutButton");

let authMode = "login";

function showAuthMessage(message, success = false) {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.classList.toggle("success", success);
}

function renderAuthMode() {
  const registering = authMode === "register";
  authTitle.textContent = registering ? "Create your student account" : "Sign in to AI Guru";
  authSubtitle.textContent = registering
    ? "Create an account to keep your saved resources and quiz progress with you."
    : "Sign in to continue learning and access your saved progress.";
  authSubmit.textContent = registering ? "Create account" : "Sign in";
  authModeToggle.textContent = registering
    ? "Already have an account? Sign in"
    : "New here? Create an account";
  authPassword.autocomplete = registering ? "new-password" : "current-password";
  authPassword.minLength = registering ? 10 : 1;
  showAuthMessage("");
}

function showAuthenticatedApp(user) {
  currentUser = user;
  studentId = user.id;
  authGate.hidden = true;
  appContent.hidden = false;
  accountBar.hidden = false;
  accountEmail.textContent = user.email;
  renderCards();
  renderTabs();
  renderDashboardCharts();
  output.textContent = "Select an AI feature, enter your input, and click Run AI Guru.";
  return loadStudentData();
}

function showSignedOutApp() {
  currentUser = null;
  studentId = null;
  studentData = { savedItems: [], quizAttempts: [] };
  authGate.hidden = false;
  appContent.hidden = true;
  accountBar.hidden = true;
  renderAuthMode();
}

authModeToggle.addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  renderAuthMode();
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value;
  authSubmit.disabled = true;
  authModeToggle.disabled = true;
  showAuthMessage(authMode === "register" ? "Creating your account..." : "Signing you in...");

  try {
    let legacyStudentId = null;
    try {
      legacyStudentId = localStorage.getItem("aiGuruStudentId");
    } catch {
      // Browser storage may be disabled; account creation still works.
    }

    const user = authMode === "register"
      ? await registerAccount(email, password, legacyStudentId)
      : await loginAccount(email, password);
    authPassword.value = "";
    await showAuthenticatedApp(user);
  } catch (error) {
    showAuthMessage(error instanceof Error ? error.message : "Authentication failed.");
  } finally {
    authSubmit.disabled = false;
    authModeToggle.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await logoutAccount();
  } catch (error) {
    console.warn("Logout request failed:", error);
  } finally {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopVoiceTracks();
    showSignedOutApp();
    logoutButton.disabled = false;
  }
});

renderAuthMode();
renderTabs();
document.querySelector("#run").addEventListener("click", run);

getCurrentAccount()
  .then(showAuthenticatedApp)
  .catch(() => showSignedOutApp());