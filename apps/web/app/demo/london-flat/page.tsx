import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText } from "lucide-react";
import { londonFlatPlan, londonFlatVariants } from "@renovation-twin/fixtures";
import { GenerateModelButton } from "../../../components/generate-model-button";
import { PlanSummary } from "../../components/plan-summary";

export default function LondonFlatDemoPage() {
  return (
    <section className="page-band">
      <div className="container workflow">
        <aside className="sidebar" aria-label="Demo workflow">
          <Link href="/demo/london-flat">1. Sample plan</Link>
          <Link href="/projects/demo-london-flat/plan">2. Plan editor</Link>
          <Link href="/projects/demo-london-flat/model">3. 3D model</Link>
          <Link href="/projects/demo-london-flat/design">4. Variants</Link>
          <Link href="/projects/demo-london-flat/report">5. Report</Link>
        </aside>
        <div className="stage">
          <div className="stage-toolbar">
            <span className="status-pill">
              <CheckCircle2 size={16} aria-hidden="true" /> Fixture loaded
            </span>
            <span>{londonFlatVariants.length} variants available</span>
          </div>
          <div className="stage-body">
            <p className="eyebrow">Fastest demo path</p>
            <h1 className="hero-title">London flat is ready.</h1>
            <p className="hero-copy">
              This route uses local fixtures so the core demo works before upload parsing, Fireworks,
              Supabase, or Novus are connected.
            </p>
            <PlanSummary plan={londonFlatPlan} />
            <div className="button-row">
              <GenerateModelButton href="/projects/demo-london-flat/model" />
              <Link className="button button-secondary" href="/projects/demo-london-flat/report">
                Open report <FileText size={18} aria-hidden="true" />
              </Link>
              <Link className="button button-secondary" href="/projects/demo-london-flat/plan">
                Plan editor <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
