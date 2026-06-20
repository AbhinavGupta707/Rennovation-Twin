# Novus readiness

RenovationTwin uses a local event contract so the official Novus install can map the product funnel without receiving sensitive floor-plan content.

## Official install flow

1. Create the RenovationTwin application in Novus.
2. Connect GitHub and authorize the `AbhinavGupta707/Rennovation-Twin` repository.
3. Select the production branch, currently `main`.
4. Let Novus scan the codebase and create its generated install PR.
5. Review and merge that PR without replacing `packages/events`.
6. Redeploy Vercel production and run the public demo flow.
7. Capture the Novus dashboard screenshot for Devpost.

## Product funnel

The judged demo funnel is:

`project_created -> floorplan_uploaded -> plan_parse_completed -> plan_confirmed -> model_generated -> walkthrough_started -> variant_generated -> report_exported -> share_created`

The local `/novus-proof` page shows these events from the app event log so the dashboard screenshot can be cross-checked against the product behavior.

## Privacy guardrails

Track counts, booleans, enum-like states, and timestamps. Do not send raw plan images, PDFs, screenshots, addresses, secrets, user prompts, or private project content to analytics events.

The current `packages/events/src/track.ts` sanitizer drops property keys that look like raw file, image, PDF, address, or raw content fields. Keep that wrapper even after the official Novus PR lands.
