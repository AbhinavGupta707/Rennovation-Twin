import { z } from "zod";

export async function runJsonModel<T>({
  system,
  user,
  schema
}: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const apiKey = process.env.FIREWORKS_API_KEY;
  const model = process.env.FIREWORKS_MODEL;

  if (!apiKey || !model) {
    throw new Error("Fireworks is not configured.");
  }

  const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Fireworks request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Fireworks returned an empty response.");
  }

  return schema.parse(JSON.parse(content));
}
