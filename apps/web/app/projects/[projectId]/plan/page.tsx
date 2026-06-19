import { ProjectShell } from "../../../components/project-shell";
import { PlanEditor } from "../../../../components/plan-editor/plan-editor";
import { getProjectOrDemo } from "../../../../lib/server/project-store";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = getProjectOrDemo(projectId);

  return (
    <ProjectShell projectId={projectId} current="plan">
      <div className="stage-body">
        <PlanEditor plan={project.plan} projectId={projectId} />
      </div>
    </ProjectShell>
  );
}
