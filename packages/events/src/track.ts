import type { EventName } from "./event-names";

export type EventProps = Record<string, string | number | boolean | null | undefined>;

export type TrackedEvent = {
  name: EventName;
  projectId?: string;
  props?: EventProps;
  createdAt: string;
};

const localEvents: TrackedEvent[] = [];

export function trackEvent(name: EventName, props?: EventProps, projectId?: string): TrackedEvent {
  const event = {
    name,
    projectId,
    props: sanitizeEventProps(props),
    createdAt: new Date().toISOString()
  };

  localEvents.push(event);
  return event;
}

export function getLocalEvents(): TrackedEvent[] {
  return [...localEvents];
}

function sanitizeEventProps(props?: EventProps): EventProps | undefined {
  if (!props) return undefined;

  return Object.fromEntries(
    Object.entries(props).filter(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      const looksSensitive =
        normalizedKey.includes("address") ||
        normalizedKey.includes("image") ||
        normalizedKey.includes("file") ||
        normalizedKey.includes("pdf") ||
        normalizedKey.includes("raw");

      return !looksSensitive && value !== undefined;
    })
  );
}
