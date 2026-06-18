import type { PlanSchema } from "@renovation-twin/types";

export function PlanSummary({ plan }: { plan: PlanSchema }) {
  return (
    <div className="stat-grid" aria-label="Plan summary">
      <div className="stat">
        <strong>{plan.walls.length}</strong>
        <span> walls</span>
      </div>
      <div className="stat">
        <strong>{plan.openings.length}</strong>
        <span> doors/windows</span>
      </div>
      <div className="stat">
        <strong>{plan.rooms.length}</strong>
        <span> rooms</span>
      </div>
      <div className="stat">
        <strong>{plan.scalePxPerMeter}</strong>
        <span> px/m</span>
      </div>
    </div>
  );
}
