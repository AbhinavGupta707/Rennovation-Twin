import { resetDemoProject } from "../../../../../lib/server/project-store";
import { jsonFail, jsonOk } from "../../../../../lib/server/api-response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;

  if (projectId !== "demo-london-flat") {
    return jsonFail(
      "not_demo_project",
      "Only the bundled sample project can be reset with this endpoint.",
      400,
    );
  }

  const project = await resetDemoProject();

  return jsonOk({ project, plan: project.plan });
}
