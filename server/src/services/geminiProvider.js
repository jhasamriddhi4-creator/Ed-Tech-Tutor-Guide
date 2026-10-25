import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

let client;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it to server/.env and restart the backend."
    );
  }

  if (!client) {
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  return client;
}

const getModel = () =>
  process.env.GEMINI_MODEL || "gemini-3.8-flash";

export async function generateText(
  prompt,
  maxOutputTokens = 1000
) {
  const ai = getClient();

  const response = await ai.interactions.create({
    model: getModel(),
    input: prompt,
    generation_config: {
      max_output_tokens: maxOutputTokens,
    },
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

export async function generateStructured(prompt, schema) {
  const ai = getClient();

  const response = await ai.interactions.create({
    model: getModel(),
    input: prompt,

    response_format: {
      type: "text",
      mime_type: "application/json",
      schema,
    },
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new Error(
      "Gemini returned an empty structured response."
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Gemini returned invalid JSON. Please try again."
    );
  }
}

export async function transcribeAudio(audioBase64, mimeType) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: [{
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
        {
          text: "Transcribe the spoken words in this audio accurately. Return only the transcript, with no commentary. If no intelligible speech is present, return an empty response.",
        },
      ],
    }],
    config: {
      maxOutputTokens: 300,
      temperature: 0,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("No speech was detected in the recording.");
  }

  return text;
}
