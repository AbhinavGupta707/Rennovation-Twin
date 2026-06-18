import Link from "next/link";
import { ArrowRight, FileUp, MousePointer2, Sparkles } from "lucide-react";
import { londonFlatPlan, londonFlatVariants } from "@renovation-twin/fixtures";

export default function HomePage() {
  return (
    <>
      <section className="page-band">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Mind the Product hackathon build</p>
            <h1 className="hero-title">Upload a floor plan. Walk through your future renovation.</h1>
            <p className="hero-copy">
              RenovationTwin turns a 2D floor plan into an editable plan, browser-based 3D walkthrough,
              AI design variants, and a shareable concept report.
            </p>
            <div className="button-row">
              <Link className="button button-primary" href="/demo/london-flat">
                Try sample flat <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="button button-secondary" href="/projects/new">
                Upload your plan <FileUp size={18} aria-hidden="true" />
              </Link>
            </div>
            <div className="stat-grid" aria-label="Demo readiness stats">
              <div className="stat">
                <strong>{londonFlatPlan.rooms.length}</strong>
                <span> rooms in fixture</span>
              </div>
              <div className="stat">
                <strong>{londonFlatPlan.walls.length}</strong>
                <span> walls ready</span>
              </div>
              <div className="stat">
                <strong>{londonFlatVariants.length}</strong>
                <span> variants</span>
              </div>
              <div className="stat">
                <strong>0</strong>
                <span> login steps</span>
              </div>
            </div>
          </div>
          <div className="stage" aria-label="RenovationTwin sample preview">
            <div className="stage-toolbar">
              <span className="status-pill">Sample demo ready</span>
              <span>London flat</span>
            </div>
            <div className="stage-body">
              <div className="model-placeholder">
                <div className="model-floor" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-band">
        <div className="container card-grid">
          <FeatureCard icon={<FileUp size={21} />} title="Upload" text="Use a PDF, PNG, JPG, or the deterministic sample flat." />
          <FeatureCard icon={<MousePointer2 size={21} />} title="Correct" text="Trace walls, place openings, label rooms, and calibrate scale." />
          <FeatureCard icon={<Sparkles size={21} />} title="Walkthrough" text="Extrude the plan, switch variants, and share a concept report." />
        </div>
      </section>
    </>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="card">
      <div className="brand-mark" aria-hidden="true">
        {icon}
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
    </article>
  );
}
