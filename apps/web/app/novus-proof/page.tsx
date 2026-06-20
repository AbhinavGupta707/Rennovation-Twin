import { Events } from "@renovation-twin/events";
import { NovusProofPanel } from "../../components/novus-proof-panel";
import { listEvents } from "../../lib/server/project-store";

const funnel = [
  Events.ProjectCreated,
  Events.FloorplanUploaded,
  Events.PlanParseStarted,
  Events.PlanParseCompleted,
  Events.ManualEditStarted,
  Events.PlanConfirmed,
  Events.ModelGenerated,
  Events.WalkthroughStarted,
  Events.VariantPromptSubmitted,
  Events.VariantGenerated,
  Events.ReportExported,
  Events.ShareCreated,
];

export const dynamic = "force-dynamic";

export default async function NovusProofPage() {
  const events = await listEvents();

  return (
    <section className="page-band">
      <div className="container">
        <NovusProofPanel funnel={funnel} initialEvents={events} />
      </div>
    </section>
  );
}
