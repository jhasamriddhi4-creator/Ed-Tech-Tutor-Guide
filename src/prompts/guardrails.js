const blockedPhrases = [
  "ignore previous instructions",
  "give direct assignment answer",
  "bypass safety",
];

const overridePatterns = [
  /\b(ignore|disregard|forget|override|bypass)\b.{0,80}\b(previous|prior|above|system|developer|safety|hidden|all|any)\b.{0,60}\b(instructions?|rules?|prompts?|guardrails?|polic(?:y|ies)|restrictions?)\b/i,
  /\b(reveal|print|repeat|show|dump|expose)\b.{0,40}\b(system|developer|hidden|internal)\b.{0,20}\b(prompt|instructions?|rules?)\b/i,
  /\b(you are now|pretend to be|act as)\b.{0,40}\b(unrestricted|unfiltered|without rules|no rules|dan|jailbreak)\b/i,
  /\b(do my graded assignment for me|give me only the final answer for my exam|write my entire graded assignment)\b/i,
  /\b(build|create|write|deploy|code)\b.{0,50}\b(ransomware|keylogger|credential stealer|password stealer)\b/i,
];

const refusalMessage =
  "Safety Guardrail: I can guide your learning step by step, but I can’t bypass safety instructions or help with a disallowed request. Ask for a safe explanation or a guided practice example instead.";

function normalizeInput(input) {
  return String(input ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function guardPrompt(input) {
  const normalized = normalizeInput(input);
  const phraseMatch = blockedPhrases.some((phrase) => {
    if (phrase === "malware") return /\bmalware\b/i.test(normalized);
    return normalized.includes(phrase);
  });
  const patternMatch = overridePatterns.some((pattern) => pattern.test(normalized));

  if (phraseMatch || patternMatch) {
    return { allowed: false, code: "GUARDRAIL_BLOCK", message: refusalMessage };
  }

  return { allowed: true, code: "ALLOWED", message: "Allowed" };
}

export function requireGrounding(chunk, answer) {
  if (!chunk) return "I don't know based on the provided material.";
  return answer;
}
