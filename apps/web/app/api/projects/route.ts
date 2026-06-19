import { NextResponse } from "next/server";
import { ok } from "@renovation-twin/types";
import { createProject } from "../../../lib/server/project-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    postcode?: string;
  };
  const project = await createProject(body);

  return NextResponse.json(
    ok({
      projectId: project.id,
      title: project.title,
    }),
  );
}
