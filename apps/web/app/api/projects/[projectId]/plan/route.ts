import { PlanSchemaZ } from "@renovation-twin/types";
import {
  getProjectOrDemo,
  savePlan,
} from "../../../../../lib/server/project-store";
import { jsonFail, jsonOk } from "../../../../../lib/server/api-response";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const project = getProjectOrDemo(projectId);

  return jsonOk({ plan: project.plan, project });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = PlanSchemaZ.safeParse(
    (body as { plan?: unknown } | null)?.plan,
  );

  if (!parsed.success) {
    return jsonFail(
      "invalid_plan",
      "Plan JSON did not match the RenovationTwin plan schema.",
      422,
    );
  }

  const project = savePlan(projectId, parsed.data);
  return jsonOk({ planVersionId: `${project.id}-${Date.now()}`, project });
}
