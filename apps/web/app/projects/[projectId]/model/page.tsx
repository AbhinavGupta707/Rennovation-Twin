import Link from "next/link";
import { BadgeInfo, Palette, TriangleAlert } from "lucide-react";
import { ProjectShell } from "../../../components/project-shell";
import { PlanModelViewer } from "../../../../components/three/plan-model-viewer";
import {
  getProjectOrDemo,
  markModelGenerated,
  markWalkthroughStarted,
} from "../../../../lib/server/project-store";

export const dynamic = "force-dynamic";

export default async function ModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { projectId } = await params;
  const { variant } = await searchParams;
  const sourceProject = await getProjectOrDemo(projectId);
  let project = sourceProject;
  let trackingWarning = false;

  try {
    const generatedProject = await markModelGenerated(sourceProject.id);
    project = await markWalkthroughStarted(generatedProject.id);
  } catch (error) {
    trackingWarning = true;
    console.error("Model visit tracking failed", error);
  }

  return (
    <ProjectShell projectId={projectId} current="model">
      <div className="stage-toolbar">
        <span className="status-pill">Interactive model ready</span>
        <span>{project.variants.length} variants</span>
      </div>
      <div className="stage-body model-stage-body">
        {trackingWarning ? (
          <p className="inline-alert alert-danger">
            <TriangleAlert size={18} aria-hidden="true" />
            3D view loaded, but this visit could not be saved to the project log.
          </p>
        ) : null}
        <div className="model-header">
          <div>
            <p className="eyebrow">3D walkthrough</p>
            <h1 className="model-title">{project.title} model</h1>
          </div>
          <div className="model-disclaimer">
            <BadgeInfo size={16} aria-hidden="true" />
            Concept visualisation only
          </div>
        </div>
        <PlanModelViewer
          projectId={projectId}
          plan={project.plan}
          variants={project.variants}
          initialVariantName={variant}
        />
        <div className="button-row">
          <Link
            className="button button-primary"
            href={`/projects/${projectId}/design`}
          >
            Choose variants <Palette size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProjectShell>
  );
}
