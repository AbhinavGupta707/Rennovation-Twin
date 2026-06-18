import { NextResponse } from "next/server";
import { trackEvent, type EventName } from "@renovation-twin/events";
import { ok } from "@renovation-twin/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name: EventName;
    projectId?: string;
    props?: Record<string, string | number | boolean | null | undefined>;
  };

  const event = trackEvent(body.name, body.props, body.projectId);
  return NextResponse.json(ok({ event }));
}
