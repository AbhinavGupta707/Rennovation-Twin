import Link from "next/link";
import { Share2 } from "lucide-react";
import { londonFlatPlan, londonFlatVariants } from "@renovation-twin/fixtures";
import { ProjectShell } from "../../../components/project-shell";

export default async function ReportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <ProjectShell projectId={projectId} current="report">
      <div className="stage-toolbar">
        <span className="status-pill">Report scaffold</span>
        <span>{londonFlatPlan.rooms.length} rooms summarized</span>
      </div>
      <div className="stage-body">
        <p className="eyebrow">Shareable report</p>
        <h1 className="hero-title">Renovation concept.</h1>
        <div className="card-grid">
          {londonFlatVariants.map((variant) => (
            <article className="card" key={variant.name}>
              <h2>{variant.name}</h2>
              <p>{variant.roomNotes[0]?.summary}</p>
            </article>
          ))}
        </div>
        <div className="button-row">
          <Link className="button button-primary" href={`/projects/${projectId}/share`}>
            Create share view <Share2 size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProjectShell>
  );
}
