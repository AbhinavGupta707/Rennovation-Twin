import { z } from "zod";

export async function runJsonModel<T>({
  system,
  user,
  schema,
  schemaName = "RenovationTwinStructuredOutput",
  jsonSchema,
  maxTokens = 1400,
  timeoutMs = 25_000,
}: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName?: string;
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<T> {
  const apiKey = process.env.FIREWORKS_API_KEY;
  const model = process.env.FIREWORKS_MODEL;

  if (!apiKey || !model) {
    throw new Error("Fireworks is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(
      "https://api.fireworks.ai/inference/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: schemaName,
              strict: true,
              schema: jsonSchema ?? toFireworksJsonSchema(schema),
            },
          },
          max_tokens: maxTokens,
          temperature: 0.1,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        }),
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw new Error("Fireworks request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

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

  let json: unknown;

  try {
    json = JSON.parse(content);
  } catch {
    throw new Error("Fireworks returned malformed JSON.");
  }

  return schema.parse(json);
}

function toFireworksJsonSchema<T>(schema: z.ZodType<T>) {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;

  delete jsonSchema.$schema;
  return jsonSchema;
}
