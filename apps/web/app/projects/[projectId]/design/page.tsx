import Link from "next/link";
import { FileText } from "lucide-react";
import { ProjectShell } from "../../../components/project-shell";
import { DesignVariantPanel } from "../../../../components/design-variant-panel";
import { getProjectOrDemo } from "../../../../lib/server/project-store";

export const dynamic = "force-dynamic";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectOrDemo(projectId);

  return (
    <ProjectShell projectId={projectId} current="design">
      <div className="stage-toolbar">
        <span className="status-pill">Fireworks with fallback</span>
        <span>3 style presets</span>
      </div>
      <div className="stage-body">
        <DesignVariantPanel
          projectId={projectId}
          initialVariants={project.variants}
          rooms={project.plan.rooms}
        />
        <div className="button-row">
          <Link
            className="button button-primary"
            href={`/projects/${projectId}/report`}
          >
            Open report <FileText size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProjectShell>
  );
}
