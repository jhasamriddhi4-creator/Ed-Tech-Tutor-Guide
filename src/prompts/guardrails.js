const blocked = ['ignore previous instructions', 'give direct assignment answer', 'bypass safety', 'malware'];

export function guardPrompt(input) {
  const normalized = input.toLowerCase();
  if (blocked.some(term => normalized.includes(term))) {
    return { allowed: false, message: 'Safety Guardrail: I can guide your learning step by step, but I cannot bypass instructions or provide direct graded-work answers.' };
  }
  return { allowed: true, message: 'Allowed' };
}

export function requireGrounding(chunk, answer) {
  if (!chunk) return "I don't know based on the provided material.";
  return answer;
}
