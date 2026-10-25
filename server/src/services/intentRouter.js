const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[!?.,;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function isSimpleGreeting(input) {
  const text = normalize(input);
  return /^(?:(?:hi|hello|hey|good morning|good afternoon|good evening)(?: there)?(?: how are you(?: doing)?)?|how are you(?: doing)?|how is it going|how's it going|what's up|what is up|how do you do|who are you|what is your name|are you real|do you have feelings|are you happy)$/.test(text);
}

export function isLiveWeatherRequest(input) {
  const text = normalize(input);

  // These are educational topics, not requests for today's conditions.
  const mentionsWeatherTechnology =
    /\b(weather api|forecast api|weather app|weather prediction model)\b/.test(text);
  const asksHowToBuildWeatherTechnology =
    /\b(how to|how do i|how can i|build|create|code|develop|make)\b.{0,45}\b(weather|forecast)\b.{0,25}\b(app|api|model|system|tool|dashboard|service)\b/.test(text);
  if (mentionsWeatherTechnology || asksHowToBuildWeatherTechnology) return false;

  const mentionsWeather =
    /\b(weather|forecast|temperature|humidity|raining|rain|snowing|snow)\b/.test(text);
  const asksAboutCurrentConditions =
    /\b(how|what|is|will|can)\b.{0,35}\b(weather|forecast|temperature|humidity|rain|snow)\b/.test(text) ||
    /\b(weather|forecast|temperature|humidity|rain|snow)\b.{0,35}\b(today|tonight|tomorrow|now|right now|current|currently|this week|live)\b/.test(text);
  const mentionsEducationalWeatherTopic =
    /\b(weather formation|weather patterns|weather and climate|weather vs climate|weather systems|weather process|how weather forms|meteorology|weather api|forecast api|weather app|weather prediction model)\b/.test(text);

  return mentionsWeather && asksAboutCurrentConditions && !mentionsEducationalWeatherTopic;
}

export function isLiveDataRequest(input) {
  const text = normalize(input);
  if (isLiveWeatherRequest(text)) return true;
  return /\b(latest news|breaking news|live score|live scores|current score|who won today|stock price right now|current stock price|current exchange rate|traffic right now|what time is it|latest election results|current election results)\b/.test(text);
}

function isVagueTopic(input) {
  const text = normalize(input);
  if (/^(?:|random|random questions?|any topic|anything|whatever|surprise me|general questions?|some questions?|a quiz|quiz|notes|study plan|make me a plan)$/.test(text)) {
    return true;
  }

  const asksForUnspecifiedContent =
    /\b(random questions?|anything|any topic|whatever|surprise me|general questions?)\b/.test(text);
  const namesASpecificTopic =
    /\b(?:about|on|covering|for the topic)\s+(?!random questions?\b|anything\b|any topic\b|whatever\b)[a-z0-9]/.test(text);

  return asksForUnspecifiedContent && !namesASpecificTopic;
}

function inputMessage(task) {
  switch (task) {
    case "quiz":
      return "Please enter a specific quiz topic, such as binary search, SQL joins, neural networks, or operating systems.";
    case "notes":
      return "Please enter a specific subject or topic for your notes.";
    case "roadmap":
      return "Please enter a specific learning goal so the planner can create a useful roadmap.";
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
        : body.topic ?? body.question;

  if (task === "tutor") {
    if (isSimpleGreeting(input)) {
      return {
        action: "reply",
        result: "I’m doing well, thanks for asking! What would you like to learn today?",
      };
    }

    if (isLiveWeatherRequest(input)) {
      return {
        action: "reply",
        result: "I can’t check today’s live weather because AI Guru isn’t connected to a weather service. I can help you learn how weather APIs work or how to build a weather app.",
      };
    }

    if (isLiveDataRequest(input)) {
      return {
        action: "reply",
        result: "I can’t retrieve live data in this app. I can explain the topic or show you how an API could provide that information.",
      };
    }

    return { action: "continue" };
  }

  if (isSimpleGreeting(input)) {
    return { action: "reject", status: 400, message: inputMessage(task) };
  }

  if (isLiveDataRequest(input)) {
    return {
      action: "reject",
      status: 400,
      message: "This feature creates study material; it doesn’t fetch live data. Enter a specific topic you want to study instead.",
    };
  }

  if (["quiz", "notes", "roadmap"].includes(task) && isVagueTopic(input)) {
    return { action: "reject", status: 400, message: inputMessage(task) };
  }

  return { action: "continue" };
}
