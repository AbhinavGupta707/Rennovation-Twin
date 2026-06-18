import { Events } from "@renovation-twin/events";

const funnel = [
  Events.ProjectCreated,
  Events.FloorplanUploaded,
  Events.PlanParseCompleted,
  Events.PlanConfirmed,
  Events.ModelGenerated,
  Events.VariantGenerated,
  Events.ShareCreated
];

export default function NovusProofPage() {
  return (
    <section className="page-band">
      <div className="container">
        <p className="eyebrow">Novus proof</p>
        <h1 className="hero-title">Measure the shipped product.</h1>
        <p className="hero-copy">
          Install Novus before submission and use this page to verify the required funnel events.
        </p>
        <div className="route-grid">
          {funnel.map((eventName, index) => (
            <article className="card" key={eventName}>
              <span className="status-pill">Step {index + 1}</span>
              <h2>{eventName}</h2>
              <p>Wire this event into the matching user flow through the shared tracking wrapper.</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
