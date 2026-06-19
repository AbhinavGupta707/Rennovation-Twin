import Link from "next/link";
import { Share2 } from "lucide-react";
import { ProjectShell } from "../../../components/project-shell";
import { ReportDeliverable } from "../../../../components/report-deliverable";
import { ReportActions } from "../../../../components/report-actions";
import { getProjectOrDemo } from "../../../../lib/server/project-store";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectOrDemo(projectId);

  return (
    <ProjectShell projectId={projectId} current="report">
      <div className="stage-toolbar">
        <span className="status-pill">Concept report ready</span>
        <span>{project.plan.rooms.length} rooms summarized</span>
      </div>
      <div className="stage-body">
        <ReportDeliverable project={project} />
        <ReportActions projectId={projectId} />
        <div className="button-row">
          <Link
            className="button button-primary"
            href={`/projects/${projectId}/share`}
          >
            Create share view <Share2 size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProjectShell>
  );
}
