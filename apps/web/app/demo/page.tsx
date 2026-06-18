import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function DemoPage() {
  return (
    <section className="page-band">
      <div className="container">
        <p className="eyebrow">Demo selector</p>
        <h1 className="hero-title">Choose a project.</h1>
        <div className="card-grid">
          <article className="card">
            <h2>London flat</h2>
            <p>Preloaded 2-bedroom flat with walls, rooms, openings, and two renovation variants.</p>
            <Link className="button button-primary" href="/demo/london-flat">
              Open demo <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
