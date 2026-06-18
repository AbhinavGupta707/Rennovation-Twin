# AGENTS.md

## Project Context

Build RenovationTwin for Mind the Product World Product Day 2026. The product is a public web app that turns an uploaded or sample 2D floor plan into an editable 2D plan, a browser-based 3D walkthrough, AI-generated renovation variants, and a shareable report.

Primary source files:

- `renovation_twin_build_ready_spec.md`
- `codex_execution_source_of_truth.md`

Read both before starting implementation in any cold session.

## Diagnostic Order

- Diagnose in layer order, not by symptom.
- If a feature is missing, unavailable, or not listed, first check registration, discovery, install state, and official activation flows.
- Only debug permissions, runtime, environment variables, or app code after the feature is actually present.

## Hackathon Non-Negotiables

- The submission must be a public deployed URL.
- Novus must be installed and there must be a Novus dashboard screenshot.
- The app must be new work for the hackathon period.
- The demo must work without login.
- The sample London flat path must work even if upload parsing, Fireworks, or external services fail.
- Do not claim CAD accuracy, structural feasibility, planning permission assessment, address-to-interior reconstruction, or contractor-grade estimates.

## Engineering Defaults

- Use Next.js App Router, TypeScript, Tailwind, shadcn/ui, pnpm, Prisma, Supabase-ready envs, Zustand, React Konva, React Three Fiber, Drei, and Fireworks through a provider wrapper.
- Keep shared contracts stable. Avoid parallel edits to `package.json`, Prisma schema, Tailwind config, and shared type files after the foundation branch lands.
- Prefer deterministic fallbacks for hackathon reliability.
- Track state transitions and counts, not raw floor plans, addresses, PDFs, or sensitive user content.
- Build for a polished sample demo first, then broaden upload support.

## Parallel Work Rules

- Foundation must land first.
- Each parallel thread must own clearly separated folders.
- Before merging, run relevant checks and summarize changed files, risks, and remaining gaps.
- Merge order: foundation, DB/API, 2D editor, 3D renderer, upload/parser, AI variants, analytics/report/demo polish.

## Verification

Run the narrowest relevant checks after each change. Use these once the scaffold exists:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm exec playwright test`
- `pnpm build`

For visual UI or 3D work, verify with browser screenshots or Playwright where possible, including that the 3D canvas is nonblank and interaction works.

## Done Means

A thread is not done until it has:

- implemented the requested slice;
- preserved the demo fallback path;
- run relevant checks or clearly explained why they could not run;
- updated or respected the source-of-truth docs when behavior changes;
- left a concise handoff for the next merge or thread.
