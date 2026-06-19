import Link from "next/link";
import { BadgeInfo, Palette } from "lucide-react";
import { londonFlatPlan, londonFlatVariants } from "@renovation-twin/fixtures";
import { ProjectShell } from "../../../components/project-shell";
import { PlanModelViewer } from "../../../../components/three/plan-model-viewer";

export default async function ModelPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { projectId } = await params;
  const { variant } = await searchParams;

  return (
    <ProjectShell projectId={projectId} current="model">
      <div className="stage-toolbar">
        <span className="status-pill">Interactive model ready</span>
        <span>{londonFlatVariants.length} deterministic variants</span>
      </div>
      <div className="stage-body model-stage-body">
        <div className="model-header">
          <div>
            <p className="eyebrow">3D walkthrough</p>
            <h1 className="model-title">London flat model</h1>
          </div>
          <div className="model-disclaimer">
            <BadgeInfo size={16} aria-hidden="true" />
            Concept visualisation only
          </div>
        </div>
        <PlanModelViewer plan={londonFlatPlan} variants={londonFlatVariants} initialVariantName={variant} />
        <div className="button-row">
          <Link className="button button-primary" href={`/projects/${projectId}/design`}>
            Choose variants <Palette size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProjectShell>
  );
}
