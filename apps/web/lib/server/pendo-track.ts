const PENDO_TRACK_URL = "https://data.pendo.io/data/track";
const PENDO_INTEGRATION_KEY = "b4e2f26b-203f-491a-bd44-5e751aed3455";

export function pendoTrackServer(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
  projectId?: string,
) {
  void fetch(PENDO_TRACK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pendo-integration-key": PENDO_INTEGRATION_KEY,
    },
    body: JSON.stringify({
      type: "track",
      event,
      visitorId: "system",
      accountId: projectId ?? "renovation-twin-public",
      timestamp: Date.now(),
      properties,
    }),
  }).catch(() => {});
}
