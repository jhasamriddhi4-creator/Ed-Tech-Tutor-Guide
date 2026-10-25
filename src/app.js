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
} from "./services/aiGuru.js";

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

function getStudentId() {
  const storageKey = "aiGuruStudentId";

  try {
    let id = localStorage.getItem(storageKey);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(storageKey, id);
    }
    return id;
  } catch {
    // This fallback keeps the app usable when browser storage is disabled.
    // It will not persist identity across reloads in that case.
    return `student-${crypto.randomUUID()}`;
  }
}

const studentId = getStudentId();
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

let currentRecognition = null;
let lastTutorAnswer = "";

function setVoiceStatus(message) {
  const status = document.querySelector("#voiceStatus");

  if (status) {
    status.textContent = message;
  }
}

function speakAnswer(text) {
  if (!("speechSynthesis" in window)) {
    setVoiceStatus(
      "Speech output is unavailable in this browser."
    );
    return;
  }

  window.speechSynthesis.cancel();

  // Remove Markdown symbols and simplify code for speech.
  const spokenText = String(text)
    .replace(/```[\s\S]*?```/g, "Code example omitted.")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/[#*_`>|]/g, " ")
    .replace(/[{}\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const utterance = new SpeechSynthesisUtterance(spokenText);

  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 1;

  utterance.onstart = () => {
    setVoiceStatus("AI Guru is speaking...");
  };

  utterance.onend = () => {
    setVoiceStatus("Answer finished. You can ask another question.");
  };

  utterance.onerror = () => {
    setVoiceStatus(
      "Speech output failed. Check your browser's audio settings."
    );
  };

  window.speechSynthesis.speak(utterance);
}

async function answerVoiceQuestion(question) {
  setVoiceStatus("AI Guru is thinking...");

  try {
    // This uses the same real backend API as the AI Tutor.
    const answer = await askTutor(question);

    lastTutorAnswer = answer;

    renderVoiceUI(answer);

    setVoiceStatus("Answer ready. Reading it aloud...");

    speakAnswer(answer);
  } catch (error) {
    setVoiceStatus(
      error instanceof Error
        ? error.message
        : "Unable to contact AI Guru."
    );
  }
}

function renderVoiceUI(answer = "") {
  output.replaceChildren();

  const wrapper = element("div", "voice-panel");

  wrapper.append(
    element("h3", "quiz-heading", "🎙️ Voice Tutor"),
    element(
      "p",
      "quiz-subtitle",
      "Ask a Computer Science question naturally. AI Guru will respond aloud."
    )
  );

  const controls = element("div", "voice-controls");

  const startButton = element(
    "button",
    "quiz-submit",
    "🎙️ Start speaking"
  );

  const stopButton = element(
    "button",
    "quiz-submit voice-secondary",
    "Stop listening"
  );

  const repeatButton = element(
    "button",
    "quiz-submit voice-secondary",
    "🔊 Read answer again"
  );

  const stopSpeechButton = element(
    "button",
    "quiz-submit voice-secondary",
    "Stop speaking"
  );

  stopButton.disabled = true;

  const status = element(
    "p",
    "quiz-status",
    "Click Start speaking and allow microphone access."
  );

  status.id = "voiceStatus";

  const answerBox = element("div", "ai-response");
  answerBox.id = "voiceAnswer";
  answerBox.innerHTML = renderMarkdown(answer);

  controls.append(
    startButton,
    stopButton,
    repeatButton,
    stopSpeechButton
  );

  wrapper.append(controls, status, answerBox);
  output.append(wrapper);

  startButton.addEventListener("click", () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceStatus(
        "Speech recognition is not supported here. Try Chrome or Edge, or type a question and click Run AI Guru."
      );
      return;
    }

    if (currentRecognition) {
      currentRecognition.stop();
    }

    const recognition = new SpeechRecognition();

    currentRecognition = recognition;
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    startButton.disabled = true;
    stopButton.disabled = false;

    recognition.onstart = () => {
      setVoiceStatus("Listening... Please ask your question.");
    };

    recognition.onresult = async (event) => {
      const transcript =
        event.results?.[0]?.[0]?.transcript?.trim();

      if (!transcript) {
        setVoiceStatus(
          "I couldn't hear a question clearly. Please try again."
        );
        return;
      }

      // Display the recognized question in the existing input.
      prompt.value = transcript;

      await answerVoiceQuestion(transcript);
    };

    recognition.onerror = (event) => {
      const messages = {
        "not-allowed":
          "Microphone access was denied. Allow microphone access in your browser settings.",
        "no-speech":
          "No speech was detected. Try speaking a little louder.",
        "audio-capture":
          "No usable microphone was found. Check your microphone connection.",
        network:
          "Browser speech recognition encountered a network error.",
      };

      setVoiceStatus(
        messages[event.error] ||
          `Speech recognition failed: ${event.error}`
      );
    };

    recognition.onend = () => {
      currentRecognition = null;
      startButton.disabled = false;
      stopButton.disabled = true;
    };

    try {
      recognition.start();
    } catch (error) {
      currentRecognition = null;
      startButton.disabled = false;
      stopButton.disabled = true;

      setVoiceStatus(
        "Unable to start speech recognition. Please try again."
      );
    }
  });

  stopButton.addEventListener("click", () => {
    if (currentRecognition) {
      currentRecognition.stop();
      currentRecognition = null;
    }

    setVoiceStatus("Stopped listening.");
  });

  repeatButton.addEventListener("click", () => {
    if (lastTutorAnswer) {
      speakAnswer(lastTutorAnswer);
    } else {
      setVoiceStatus("Ask a question before replaying an answer.");
    }
  });

  stopSpeechButton.addEventListener("click", () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

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
        answers,
        studentId
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
    console.error("AI Guru request failed:", error);

    output.textContent =
      `Request failed: ${
        error instanceof Error
          ? error.message
          : "Unknown error"
      }`;
  }
}


renderCards();
renderTabs();
renderDashboardCharts();

output.textContent =
  "Select an AI feature, enter your input, and click Run AI Guru.";

document.querySelector("#run").addEventListener("click", run);
loadStudentData();