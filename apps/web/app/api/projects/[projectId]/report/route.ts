import { markReportExported } from "../../../../../lib/server/project-store";
import { jsonOk } from "../../../../../lib/server/api-response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const project = await markReportExported(projectId);
  const report = project.reportExports[0];

  return jsonOk({
    reportId: report?.id ?? `${project.id}-report`,
    exportedAt: report?.createdAt ?? new Date().toISOString(),
    screenshotId: report?.screenshotId,
  });
}
