const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[!?.,;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function isSimpleGreeting(input) {
  const text = normalize(input);
  return /^(?:(?:hi|hello|hey|good morning|good afternoon|good evening)(?: there)?(?: how are you(?: doing)?)?|how are you(?: doing)?|how is it going|how's it going|what's up|what is up|how do you do|who are you|what is your name|are you real|do you have feelings|are you happy)$/.test(text);
}

export function isLiveWeatherRequest(input) {
  const text = normalize(input);
  const asksHowTo = /\b(how to|how do i|how can i|build|create|code|develop|make)\\b.{0,60}\b(weather app|weather api|forecast app|forecast api|weather prediction model)\b/.test(text);
  if (asksHowTo) return false;

  const mentionsWeather = /\b(weather|forecast|temperature|humidity|raining|rain|snowing|snow)\b/.test(text);
  const asksForCurrent = /\b(today|tonight|tomorrow|now|right now|current|currently|this week|what is the weather|what's the weather|how is the weather|how's the weather|weather in|forecast for|will it rain|is it raining)\b/.test(text);
  return mentionsWeather && asksForCurrent;
}

export function isLiveDataRequest(input) {
  const text = normalize(input);
  if (isLiveWeatherRequest(text)) return true;

  return /\b(latest news|breaking news|live score|live scores|current score|who won today|stock price right now|current stock price|current exchange rate|traffic right now|what time is it|latest election results|current election results)\b/.test(text);
}

function isVagueTopic(input) {
  const text = normalize(input);
  return /^(?:|random|random questions?|any topic|anything|whatever|surprise me|general questions?|some questions?|a quiz|quiz|notes|study plan|make me a plan)$/.test(text);
}

function tabInputMessage(task) {
  switch (task) {
    case "quiz":
      return "Please enter a specific topic for the quiz, such as binary search, SQL joins, neural networks, or operating systems.";
    case "notes":
      return "Please enter the subject or topic you want notes about.";
    case "roadmap":
      return "Please enter a specific learning goal so the planner can build a relevant roadmap.";
    case "code":
      return "Please paste the code you want reviewed.";
    case "rag":
      return "Please enter a question about the supplied study material.";
    default:
      return "Please enter a specific study question or learning task.";
  }
}

export function routeStudentRequest(task, body = {}) {
  const input = task === "tutor" || task === "rag"
    ? body.question
    : task === "code"
      ? body.code
      : task === "roadmap"
        ? body.goal
        : body.topic;

  if (task === "tutor") {
    if (isSimpleGreeting(input)) {
      return {
        action: "reply",
        result: "I’m here and ready to help! What would you like to learn today?",
      };
    }

    if (isLiveWeatherRequest(input)) {
      return {
        action: "reply",
        result: "I can’t check live weather because this app isn’t connected to a live-weather service. I can help you understand weather APIs or build a weather app if that’s what you’re studying.",
      };
    }

    if (isLiveDataRequest(input)) {
      return {
        action: "reply",
        result: "I can’t retrieve live updates in this app. I can explain the underlying topic or help you learn how an API could provide that data.",
      };
    }

    return { action: "continue" };
  }

  // Content-generation tabs must receive a meaningful learning input, not
  // greetings, casual conversation, or requests for live data this app lacks.
  if (isSimpleGreeting(input)) {
    return {
      action: "reject",
      status: 400,
      message: tabInputMessage(task),
    };
  }

  if (isLiveDataRequest(input)) {
    return {
      action: "reject",
      status: 400,
      message: "This tab creates study material; it cannot fetch live data. Enter a specific topic you want to study instead.",
    };
  }

  if (["quiz", "notes", "roadmap"].includes(task) && isVagueTopic(input)) {
    return {
      action: "reject",
      status: 400,
      message: tabInputMessage(task),
    };
  }

  return { action: "continue" };
}
