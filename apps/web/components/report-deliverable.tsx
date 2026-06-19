import {
  BadgeInfo,
  Camera,
  FileText,
  Layers3,
  Palette,
  TriangleAlert,
} from "lucide-react";
import type { ProjectRecord } from "../lib/server/project-store";

export function ReportDeliverable({
  project,
  publicView = false,
}: {
  project: ProjectRecord;
  publicView?: boolean;
}) {
  const latestScreenshot = project.screenshots[0];
  const variants = project.variants;
  const primaryVariant = variants[0];
  const secondaryVariant = variants[1];
  const latestUpload = project.uploads[0];
  const roomBriefs = project.plan.rooms.map((room) => {
    const notes = variants
      .flatMap((variant) =>
        variant.roomNotes
          .filter((note) => note.roomId === room.id)
          .map((note) => ({ variantName: variant.name, note })),
      )
      .slice(0, 3);

    return { room, notes };
  });
  const warnings = [
    "Concept visualisation only. Not architectural, structural, planning, or contractor-grade advice.",
    "Measurements and wall proposals must be checked before design, purchase, or build decisions.",
    ...variants.flatMap((variant) => variant.warnings),
  ];
  const changedItems = variants.flatMap((variant) =>
    variant.roomNotes.slice(0, 3).flatMap((note) =>
      note.changes.slice(0, 2).map((change) => ({
        variantName: variant.name,
        roomId: note.roomId,
        change,
      })),
    ),
  );

  return (
    <div className="report-deliverable">
      <section className="report-hero">
        <div>
          <p className="eyebrow">
            {publicView ? "Shared concept report" : "Shareable concept report"}
          </p>
          <h1 className="section-title">{project.title} concept.</h1>
          <p className="hero-copy small-copy">
            A compact visual brief for reviewing the confirmed floor plan, the
            latest 3D view, and the design directions. Concept visualisation
            only.
          </p>
        </div>
        <div className="model-disclaimer">
          <BadgeInfo size={16} aria-hidden="true" />
          Not CAD or structural advice
        </div>
      </section>

      <section className="report-visual-grid" aria-label="Visual evidence">
        <article className="visual-panel">
          <div className="visual-panel-heading">
            <FileText size={18} aria-hidden="true" />
            <h2>Confirmed plan</h2>
          </div>
          <div className="report-image-frame plan-image-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.plan.image.url}
              alt="Confirmed floor plan preview"
            />
          </div>
        </article>

        <article className="visual-panel">
          <div className="visual-panel-heading">
            <Camera size={18} aria-hidden="true" />
            <h2>Captured 3D view</h2>
          </div>
          <div className="report-image-frame model-image-frame">
            {latestScreenshot ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={latestScreenshot.imageDataUrl}
                  alt={`3D model screenshot using ${latestScreenshot.cameraPreset ?? "selected"} camera`}
                />
                <span>
                  {latestScreenshot.variantName ?? "Selected variant"} ·{" "}
                  {latestScreenshot.cameraPreset ?? "3D camera"}
                </span>
              </>
            ) : (
              <div className="screenshot-empty">
                <Camera size={26} aria-hidden="true" />
                <strong>No captured 3D view yet</strong>
                <span>
                  Capture a view from the model page before final export.
                </span>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="report-kpi-grid" aria-label="Project summary">
        <div>
          <span>Rooms</span>
          <strong>{project.plan.rooms.length}</strong>
        </div>
        <div>
          <span>Walls</span>
          <strong>{project.plan.walls.length}</strong>
        </div>
        <div>
          <span>Openings</span>
          <strong>{project.plan.openings.length}</strong>
        </div>
        <div>
          <span>Variants</span>
          <strong>{variants.length}</strong>
        </div>
        <div>
          <span>Scale</span>
          <strong>{Math.round(project.plan.scalePxPerMeter)} px/m</strong>
        </div>
      </section>

      <section className="project-summary-brief" aria-label="Project summary">
        <div>
          <p className="eyebrow">Project summary</p>
          <h2>{project.title}</h2>
          <p>
            Status: {project.status.toLowerCase().replaceAll("_", " ")}.
            {latestUpload
              ? ` Source: ${latestUpload.fileName} (${latestUpload.mimeType}).`
              : " Source: sample London flat fixture."}
          </p>
        </div>
        <dl>
          <div>
            <dt>Captured views</dt>
            <dd>{project.screenshots.length}</dd>
          </div>
          <div>
            <dt>Report exports</dt>
            <dd>{project.reportExports.length}</dd>
          </div>
          <div>
            <dt>Share state</dt>
            <dd>
              {project.shareToken ? "Public link ready" : "Not shared yet"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="comparison-grid" aria-label="Variant comparison">
        <div className="comparison-heading">
          <Palette size={18} aria-hidden="true" />
          <h2>Variant comparison</h2>
        </div>
        {variants.length ? (
          variants.slice(0, 3).map((variant) => (
            <article className="variant-compare" key={variant.name}>
              <div>
                <h3>{variant.name}</h3>
                <p>{variant.style}</p>
              </div>
              <div
                className="palette-row"
                aria-label={`${variant.name} palette`}
              >
                <span style={{ backgroundColor: variant.palette.wall }} />
                <span style={{ backgroundColor: variant.palette.floor }} />
                <span style={{ backgroundColor: variant.palette.accent }} />
                <span style={{ backgroundColor: variant.palette.textile }} />
              </div>
              {variant.rationale ? (
                <p className="variant-rationale">{variant.rationale}</p>
              ) : null}
              <ul className="compact-list">
                {variant.roomNotes.slice(0, 2).map((note) => (
                  <li key={`${variant.name}-${note.roomId}`}>
                    <strong>{note.summary}</strong>
                    <span>{note.changes.slice(0, 2).join(", ")}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))
        ) : (
          <article className="variant-compare">
            <h3>No variants yet</h3>
            <p>Generate a design direction before sharing the final brief.</p>
          </article>
        )}
      </section>

      <section className="what-changed" aria-label="What changed">
        <div className="comparison-heading">
          <Layers3 size={18} aria-hidden="true" />
          <h2>What changed</h2>
        </div>
        <div className="change-list">
          {(changedItems.length
            ? changedItems
            : [
                {
                  variantName: primaryVariant?.name ?? "Survey Base",
                  roomId: secondaryVariant?.name ?? "Plan",
                  change: "Capture a variant to populate the handoff list.",
                },
              ]
          ).map((item) => (
            <div key={`${item.variantName}-${item.roomId}-${item.change}`}>
              <span>{item.variantName}</span>
              <strong>{item.change}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="room-brief-grid" aria-label="Room-by-room brief">
        <div className="comparison-heading">
          <FileText size={18} aria-hidden="true" />
          <h2>Room-by-room brief</h2>
        </div>
        {roomBriefs.length ? (
          roomBriefs.map(({ room, notes }) => (
            <article key={room.id} className="room-brief-card">
              <div>
                <h3>{room.label}</h3>
                <p>
                  {room.areaM2 ? `${room.areaM2} m2` : "Area to confirm"} ·{" "}
                  {room.floorMaterial ?? "finish to confirm"}
                </p>
              </div>
              {notes.length ? (
                <ul className="compact-list">
                  {notes.map(({ variantName, note }) => (
                    <li key={`${room.id}-${variantName}`}>
                      <strong>{variantName}</strong>
                      <span>
                        {note.summary} {note.changes.slice(0, 2).join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hero-copy small-copy">
                  Keep existing layout; add manual notes during the next review.
                </p>
              )}
            </article>
          ))
        ) : (
          <article className="room-brief-card">
            <h3>Manual trace needed</h3>
            <p>Confirm rooms in the plan editor to populate this section.</p>
          </article>
        )}
      </section>

      <section
        className="report-warning-panel"
        aria-label="Warnings and disclaimers"
      >
        <div className="comparison-heading">
          <TriangleAlert size={18} aria-hidden="true" />
          <h2>Warnings and disclaimers</h2>
        </div>
        <ul className="warning-list">
          {[...new Set(warnings)].map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
