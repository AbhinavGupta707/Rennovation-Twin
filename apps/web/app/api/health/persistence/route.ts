import { NextResponse } from "next/server";
import {
  getProjectStoreMode,
  listEvents,
} from "../../../../lib/server/project-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getProjectStoreMode();

  try {
    const events = await listEvents();

    return NextResponse.json({
      ok: true,
      store,
      eventCount: events.length,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        store,
        error:
          error instanceof Error
            ? error.message
            : "Persistence health check failed.",
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
