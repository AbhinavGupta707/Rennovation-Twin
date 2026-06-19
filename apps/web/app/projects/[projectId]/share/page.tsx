import { ProjectShell } from "../../../components/project-shell";
import { ShareActions } from "../../../../components/share-actions";
import { getProjectOrDemo } from "../../../../lib/server/project-store";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = getProjectOrDemo(projectId);

  return (
    <ProjectShell projectId={projectId} current="share">
      <div className="stage-toolbar">
        <span className="status-pill">Tokenized public view</span>
        <span>No login required</span>
      </div>
      <div className="stage-body">
        <ShareActions
          projectId={projectId}
          initialShareToken={project.shareToken}
        />
      </div>
    </ProjectShell>
  );
}
