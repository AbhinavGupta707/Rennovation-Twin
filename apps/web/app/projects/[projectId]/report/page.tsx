import Link from "next/link";
import { Share2 } from "lucide-react";
import { ProjectShell } from "../../../components/project-shell";
import { PlanSummary } from "../../../components/plan-summary";
import { ReportActions } from "../../../../components/report-actions";
import { getProjectOrDemo } from "../../../../lib/server/project-store";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = getProjectOrDemo(projectId);

  return (
    <ProjectShell projectId={projectId} current="report">
      <div className="stage-toolbar">
        <span className="status-pill">Concept report ready</span>
        <span>{project.plan.rooms.length} rooms summarized</span>
      </div>
      <div className="stage-body">
        <p className="eyebrow">Shareable report</p>
        <h1 className="section-title">{project.title} concept.</h1>
        <PlanSummary plan={project.plan} />
        {project.variants.length ? (
          <div className="card-grid">
            {project.variants.map((variant) => (
              <article className="card" key={variant.name}>
                <h2>{variant.name}</h2>
                <p>{variant.roomNotes[0]?.summary}</p>
                <ul className="compact-list">
                  {variant.roomNotes.slice(0, 3).map((note) => (
                    <li key={`${variant.name}-${note.roomId}`}>
                      <strong>{note.roomId}</strong>
                      <span>{note.changes.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <article className="card">
            <h2>No variants yet</h2>
            <p>Generate a design variant before sharing a report.</p>
          </article>
        )}
        <ReportActions projectId={projectId} />
        <div className="button-row">
          <Link
            className="button button-primary"
            href={`/projects/${projectId}/share`}
          >
            Create share view <Share2 size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProjectShell>
  );
}
