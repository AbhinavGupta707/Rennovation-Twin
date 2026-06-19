import { londonFlatPlan } from "@renovation-twin/fixtures";
import { ProjectShell } from "../../../components/project-shell";
import { PlanEditor } from "../../../../components/plan-editor/plan-editor";

export default async function PlanPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <ProjectShell projectId={projectId} current="plan">
      <div className="stage-body">
        <PlanEditor plan={londonFlatPlan} projectId={projectId} />
      </div>
    </ProjectShell>
  );
}
