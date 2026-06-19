import { notFound } from "next/navigation";
import { BadgeInfo } from "lucide-react";
import { ReportDeliverable } from "../../../components/report-deliverable";
import { PlanModelViewer } from "../../../components/three/plan-model-viewer";
import { getProjectByShareToken } from "../../../lib/server/project-store";

export const dynamic = "force-dynamic";

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const project = await getProjectByShareToken(token);

  if (!project) {
    notFound();
  }

  return (
    <section className="page-band">
      <div className="container public-report">
        <ReportDeliverable project={project} publicView />

        <div className="stage-body model-stage-body">
          <div className="model-header">
            <div>
              <p className="eyebrow">Read-only walkthrough</p>
              <h2 className="model-title">Explore the shared model.</h2>
            </div>
            <div className="model-disclaimer">
              <BadgeInfo size={16} aria-hidden="true" />
              Public view
            </div>
          </div>
          <PlanModelViewer
            plan={project.plan}
            variants={project.variants}
            readOnly
          />
        </div>
      </div>
    </section>
  );
}
