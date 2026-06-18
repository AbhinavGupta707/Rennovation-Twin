import Image from "next/image";
import { londonFlatPlan } from "@renovation-twin/fixtures";
import { ProjectShell } from "../../../components/project-shell";
import { PlanSummary } from "../../../components/plan-summary";

export default async function PlanPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <ProjectShell projectId={projectId} current="plan">
      <div className="stage-toolbar">
        <span className="status-pill">Manual trace fallback ready</span>
        <span>Scale: {londonFlatPlan.scalePxPerMeter} px/m</span>
      </div>
      <div className="stage-body">
        <p className="eyebrow">2D plan editor</p>
        <h1 className="hero-title">Confirm the plan.</h1>
        <div className="plan-preview">
          <Image src={londonFlatPlan.image.url} width={980} height={700} alt="Sample London flat floor plan" priority />
        </div>
        <PlanSummary plan={londonFlatPlan} />
      </div>
    </ProjectShell>
  );
}
