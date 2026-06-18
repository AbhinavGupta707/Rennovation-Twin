# RenovationTwin Architecture

## Product Spine

RenovationTwin is optimized around the hackathon demo path:

1. Load the sample London flat.
2. Confirm or view the 2D plan.
3. Generate a 3D walkthrough from `PlanSchema`.
4. Switch between deterministic or Fireworks-generated design variants.
5. Create a shareable report.
6. Show Novus and local event proof.

## Frontend

The web app uses Next.js App Router. Routes live under `apps/web/app`.

Primary route groups:

- `/`: app-first entry screen.
- `/demo` and `/demo/london-flat`: deterministic demo path.
- `/projects/new`: project creation.
- `/projects/[projectId]/upload`: upload and preview.
- `/projects/[projectId]/plan`: 2D editor.
- `/projects/[projectId]/model`: 3D walkthrough.
- `/projects/[projectId]/design`: variant generation.
- `/projects/[projectId]/report`: report.
- `/projects/[projectId]/share`: share handoff.
- `/settings/privacy`: privacy and deletion posture.
- `/novus-proof`: event funnel proof.

## Shared Contracts

`packages/types` owns `PlanSchema`, `DesignVariantSchema`, and API response types. Feature threads should import these contracts rather than redefining them.

## Fallback Strategy

- Floor-plan parsing is a proposal, never truth.
- Manual trace must always work.
- Fireworks calls go through `packages/ai` and fall back to deterministic variants.
- The sample London flat must work without external services.

## Event Strategy

`packages/events` owns event names and the `trackEvent` wrapper. Do not send raw floor plans, addresses, PDFs, user-uploaded images, or sensitive personal content to analytics.
