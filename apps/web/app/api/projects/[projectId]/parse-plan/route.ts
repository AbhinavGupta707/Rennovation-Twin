import { parsePlan } from "../../../../../lib/server/project-store";
import { jsonOk } from "../../../../../lib/server/api-response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const result = await parsePlan(projectId);

  return jsonOk(result);
}
