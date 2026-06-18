import { NextResponse } from "next/server";
import { Events, trackEvent } from "@renovation-twin/events";
import { ok } from "@renovation-twin/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { title?: string; postcode?: string };
  const projectId = `demo-${crypto.randomUUID()}`;

  trackEvent(Events.ProjectCreated, { hasPostcode: Boolean(body.postcode) }, projectId);

  return NextResponse.json(
    ok({
      projectId,
      title: body.title ?? "Untitled renovation"
    })
  );
}
