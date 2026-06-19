"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { EventName, TrackedEvent } from "@renovation-twin/events";
import type { ApiResponse } from "@renovation-twin/types";

type EventsData = {
  events: TrackedEvent[];
};

export function NovusProofPanel({
  funnel,
  initialEvents,
}: {
  funnel: EventName[];
  initialEvents: TrackedEvent[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [busy, setBusy] = useState(false);

  const eventCounts = useMemo(() => {
    return new Map(
      funnel.map((eventName) => [
        eventName,
        events.filter((event) => event.name === eventName).length,
      ]),
    );
  }, [events, funnel]);

  async function refreshEvents() {
    setBusy(true);
    try {
      const response = await fetch("/api/events");
      const payload = (await response.json()) as ApiResponse<EventsData>;
      if (payload.ok) {
        setEvents(payload.data.events);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="proof-grid">
      <section className="tool-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Novus proof</p>
            <h1 className="section-title">Measure the shipped product.</h1>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={refreshEvents}
          >
            <RefreshCw
              className={busy ? "spin-icon" : undefined}
              size={18}
              aria-hidden="true"
            />{" "}
            Refresh
          </button>
        </div>
        <div className="funnel-grid">
          {funnel.map((eventName, index) => {
            const count = eventCounts.get(eventName) ?? 0;
            return (
              <article className="stat" key={eventName}>
                <span>Step {index + 1}</span>
                <strong>{count}</strong>
                <span>{eventName}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="tool-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Event log</p>
            <h2 className="panel-title">Latest local events</h2>
          </div>
          <span className="status-pill">{events.length} total</span>
        </div>
        <div className="event-table" role="table" aria-label="Latest events">
          <div role="row">
            <span role="columnheader">Event</span>
            <span role="columnheader">Project</span>
            <span role="columnheader">Time</span>
          </div>
          {events
            .slice(-12)
            .reverse()
            .map((event) => (
              <div role="row" key={`${event.name}-${event.createdAt}`}>
                <span role="cell">{event.name}</span>
                <span role="cell">{event.projectId ?? "n/a"}</span>
                <span role="cell">{formatEventTime(event.createdAt)}</span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

function formatEventTime(value: string) {
  return new Date(value).toISOString().slice(11, 19);
}
