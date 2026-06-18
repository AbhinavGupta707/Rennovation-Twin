import Link from "next/link";
import { FileText } from "lucide-react";
import { londonFlatVariants } from "@renovation-twin/fixtures";
import { ProjectShell } from "../../../components/project-shell";

export default async function DesignPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <ProjectShell projectId={projectId} current="design">
      <div className="stage-toolbar">
        <span className="status-pill">Deterministic fallback variants</span>
        <span>{londonFlatVariants.length} styles</span>
      </div>
      <div className="stage-body">
        <p className="eyebrow">AI design variants</p>
        <h1 className="hero-title">Pick a direction.</h1>
        <div className="card-grid">
          {londonFlatVariants.map((variant) => (
            <article className="card" key={variant.name}>
              <h2>{variant.name}</h2>
              <p>{variant.style}</p>
              <p>
                Wall {variant.palette.wall}, floor {variant.palette.floor}, accent {variant.palette.accent}
              </p>
            </article>
          ))}
        </div>
        <div className="button-row">
          <Link className="button button-primary" href={`/projects/${projectId}/report`}>
            Open report <FileText size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProjectShell>
  );
}
