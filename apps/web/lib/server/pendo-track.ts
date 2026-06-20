const PENDO_TRACK_URL = "https://data.pendo.io/data/track";
const GENERATED_PENDO_INTEGRATION_KEY = "b4e2f26b-203f-491a-bd44-5e751aed3455";

export function pendoTrackServer(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
  projectId?: string,
) {
  const integrationKey =
    process.env.PENDO_INTEGRATION_KEY || GENERATED_PENDO_INTEGRATION_KEY;

  if (!integrationKey) {
    return;
  }

  void fetch(PENDO_TRACK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pendo-integration-key": integrationKey,
    },
    body: JSON.stringify({
      type: "track",
      event,
      visitorId: "system",
      accountId: projectId ?? "renovation-twin-public",
      timestamp: Date.now(),
      properties: sanitizePendoProperties(properties),
    }),
  }).catch(() => {});
}

function sanitizePendoProperties(
  properties?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!properties) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      const looksSensitive =
        normalizedKey.includes("address") ||
        normalizedKey.includes("image") ||
        normalizedKey.includes("file") ||
        normalizedKey.includes("pdf") ||
        normalizedKey.includes("raw") ||
        normalizedKey.includes("prompt");

      return !looksSensitive && value !== undefined;
    }),
  );
}
