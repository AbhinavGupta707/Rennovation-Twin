import { getProjectOrDemo } from "../../../../lib/server/project-store";
import { jsonOk } from "../../../../lib/server/api-response";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const project = getProjectOrDemo(projectId);

  return jsonOk({ project });
}
