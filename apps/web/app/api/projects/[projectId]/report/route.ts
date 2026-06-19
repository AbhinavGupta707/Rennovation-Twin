import { markReportExported } from "../../../../../lib/server/project-store";
import { jsonOk } from "../../../../../lib/server/api-response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const project = markReportExported(projectId);
  const exportedAt = new Date().toISOString();

  return jsonOk({
    reportId: `${project.id}-${Date.now()}`,
    exportedAt,
  });
}
