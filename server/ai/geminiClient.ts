import { KAMIYA_SYSTEM_PROMPT } from "./prompts";

interface GeminiJsonOptions {
  prompt: string;
  responseSchema: Record<string, unknown>;
}

export async function generateGeminiJson<T>({ prompt, responseSchema }: GeminiJsonOptions): Promise<T | null> {
  const apiKey = process.env.KAMIYA_GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.KAMIYA_GEMINI_MODEL ?? "gemini-3.1-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: KAMIYA_SYSTEM_PROMPT }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned an empty structured response");

  return JSON.parse(text) as T;
}
