const blockedPhrases = [
  "ignore previous instructions",
  "ignore all previous instructions",
  "give direct assignment answer",
  "bypass safety",
  "reveal the system prompt",
  "override the guardrails",
  "disable the guardrails",
];

const blockedPatterns = [
  /\b(ignore|disregard|forget|override|bypass|stop following|do not follow)\b.{0,120}\b(previous|prior|above|system|developer|hidden|safety|all|any|earlier)\b.{0,120}\b(instructions?|rules?|prompts?|guardrails?|polic(?:y|ies)|restrictions?)\b/i,
  /\b(reveal|print|repeat|show|dump|expose|quote|output|tell me)\b.{0,60}\b(the\s+)?(your\s+)?(system|developer|hidden|internal)\s+(prompt|instructions?|rules?)\b/i,
  /\b(disable|turn off|remove|circumvent|bypass)\b.{0,40}\b(safety|guardrails?|filters?|restrictions?|polic(?:y|ies))\b/i,
  /\b(pretend|act|behave|respond)\b.{0,50}\b(unrestricted|unfiltered|without (any )?rules|no restrictions|developer mode|dan mode|jailbreak mode)\b/i,
  /\b(new system prompt|developer override|ignore the policy|forget your rules)\b/i,
  /\b(do|complete|finish|write|solve|answer|submit)\b.{0,50}\b(my|this|the)\b.{0,35}\b(entire|whole|full|graded|final)\s+(assignment|homework|exam|test|quiz|assessment)\b/i,
  /\b(do|complete|finish|write|solve|answer|submit)\b.{0,45}\b(my|this|the)\b.{0,45}\b(assignment|homework|exam|test|quiz|assessment)\b.{0,45}\b(for me|to submit|as my own|without steps|without explanation|only answers?)\b/i,
  /\b(only|just)\s+(give|provide|output|return)?\s*(the\s+)?(final\s+)?answers?\b.{0,70}\b(graded|assignment|homework|exam|test|quiz|assessment)\b/i,
  /\b(assignment|homework|exam|test|quiz|assessment)\b.{0,45}\b(only the answers|final answers only|do it for me|complete it for me)\b/i,
  /\b(hack into|break into|gain unauthorized access to|steal credentials|steal passwords|phish for credentials|deploy ransomware)\b/i,
  /\b(build|create|write|deploy|code|make|implement)\b.{0,80}\b(ransomware|keylogger|credential stealer|password stealer|malware that steals|remote access trojan|steal credentials|steal passwords)\b/i,
];

const refusalMessage =
  "Safety Guardrail: I can help you understand the concept, work through a similar practice problem, or learn defensive techniques, but I can’t bypass safety rules, complete graded work for submission, or provide instructions for harmful activity.";

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
  const phraseMatch = blockedPhrases.some((phrase) => normalized.includes(phrase));
  const patternMatch = blockedPatterns.some((pattern) => pattern.test(normalized));

  if (phraseMatch || patternMatch) {
    return {
      allowed: false,
      code: "GUARDRAIL_BLOCK",
      message: refusalMessage,
    };
  }

  return { allowed: true, code: "ALLOWED", message: "Allowed" };
}

export function requireGrounding(chunk, answer) {
  if (!chunk) return "I don't know based on the provided material.";
  return answer;
}
