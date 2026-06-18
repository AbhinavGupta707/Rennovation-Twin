import Link from "next/link";
import { Palette } from "lucide-react";
import { londonFlatPlan } from "@renovation-twin/fixtures";
import { getPlanBoundsMeters, planToWallMeshSpecs } from "@renovation-twin/geometry";
import { ProjectShell } from "../../../components/project-shell";

export default async function ModelPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const bounds = getPlanBoundsMeters(londonFlatPlan);
  const wallMeshCount = planToWallMeshSpecs(londonFlatPlan).length;

  return (
    <ProjectShell projectId={projectId} current="model">
      <div className="stage-toolbar">
        <span className="status-pill">3D contract scaffolded</span>
        <span>{wallMeshCount} wall meshes</span>
      </div>
      <div className="stage-body">
        <p className="eyebrow">3D walkthrough</p>
        <h1 className="hero-title">Walk the model.</h1>
        <div className="model-placeholder" aria-label="3D placeholder model">
          <div className="model-floor" />
        </div>
        <p>
          Plan bounds: {bounds.widthM.toFixed(1)}m by {bounds.depthM.toFixed(1)}m. React Three Fiber implementation
          belongs to the 3D renderer thread.
        </p>
        <div className="button-row">
          <Link className="button button-primary" href={`/projects/${projectId}/design`}>
            Choose variants <Palette size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProjectShell>
  );
}
