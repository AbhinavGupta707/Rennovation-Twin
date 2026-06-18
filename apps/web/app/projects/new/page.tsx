import Link from "next/link";
import { ArrowRight, FileUp } from "lucide-react";

export default function NewProjectPage() {
  return (
    <section className="page-band">
      <div className="container hero-grid">
        <div>
          <p className="eyebrow">Start project</p>
          <h1 className="hero-title">Create a renovation twin.</h1>
          <p className="hero-copy">
            Upload support is scaffolded for PNG, JPG, and PDF. For the hackathon path, the sample flat
            remains the reliable fallback.
          </p>
          <div className="button-row">
            <Link className="button button-primary" href="/projects/demo-london-flat/upload">
              Continue upload flow <FileUp size={18} aria-hidden="true" />
            </Link>
            <Link className="button button-secondary" href="/demo/london-flat">
              Use sample flat <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="card">
          <h2>Concept visualisation only</h2>
          <p>
            RenovationTwin does not provide architectural, structural, planning permission, or
            contractor-grade measurement advice.
          </p>
        </div>
      </div>
    </section>
  );
}
