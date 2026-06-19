import { NextResponse } from "next/server";
import {
  Events,
  getLocalEvents,
  trackEvent,
  type EventName,
} from "@renovation-twin/events";
import { fail, ok } from "@renovation-twin/types";

export async function GET() {
  return NextResponse.json(ok({ events: getLocalEvents() }));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name: EventName;
    projectId?: string;
    props?: Record<string, string | number | boolean | null | undefined>;
  } | null;

  if (!body || !Object.values(Events).includes(body.name)) {
    return NextResponse.json(fail("invalid_event", "Event name is required."), {
      status: 400,
    });
  }

  const event = trackEvent(body.name, body.props, body.projectId);
  return NextResponse.json(ok({ event }));
}
