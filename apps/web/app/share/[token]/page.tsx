import { notFound } from "next/navigation";
import { BadgeInfo } from "lucide-react";
import { PlanSummary } from "../../components/plan-summary";
import { PlanModelViewer } from "../../../components/three/plan-model-viewer";
import { getProjectByShareToken } from "../../../lib/server/project-store";

export const dynamic = "force-dynamic";

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const project = getProjectByShareToken(token);

  if (!project) {
    notFound();
  }

  return (
    <section className="page-band">
      <div className="container public-report">
        <div className="model-header">
          <div>
            <p className="eyebrow">Shared concept report</p>
            <h1 className="model-title">{project.title}</h1>
          </div>
          <div className="model-disclaimer">
            <BadgeInfo size={16} aria-hidden="true" />
            Concept visualisation only
          </div>
        </div>

        <PlanSummary plan={project.plan} />

        <div className="stage-body model-stage-body">
          <PlanModelViewer plan={project.plan} variants={project.variants} />
        </div>

        <section className="card-grid" aria-label="Variant report">
          {project.variants.map((variant) => (
            <article className="card" key={variant.name}>
              <h2>{variant.name}</h2>
              <p>{variant.style}</p>
              {variant.roomNotes[0] ? (
                <p>{variant.roomNotes[0].summary}</p>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
