# RenovationTwin Codex Execution Source of Truth

This file is the operational handoff for cold Codex sessions. The product specification remains `renovation_twin_build_ready_spec.md`; this file converts it into execution strategy, goal prompts, stage gates, and merge rules.

## Hackathon Brief

Hackathon: Mind the Product presents World Product Day: Everyone Ships Now.

Deadline: June 20, 2026 at 5:00 PM BST.

Eligibility and submission requirements:

- Build a new working software application.
- Submit a public deployed URL.
- Include a demo video under 3 minutes.
- Include a Novus.ai dashboard screenshot.
- Include a written description of what was built, who it is for, tools used, and what was learned.
- Judges score Product Thinking, Craft and Execution, Originality and Ambition, and Shippedness equally at 25% each.

Product implication: RenovationTwin should optimize for an immediately usable, visually impressive, end-to-end demo rather than hard technical perfection in floor-plan computer vision.

## Product Definition

RenovationTwin lets someone upload or select a 2D floor plan, correct it in a 2D editor, set scale, generate a browser-based 3D model, apply AI renovation variants, walk through the result, and share a report.

Primary winning demo:

1. Open public URL.
2. Click "Try sample flat."
3. Confirm scale.
4. Generate 3D.
5. Switch between at least two variants.
6. Walk/orbit the model.
7. Share/export a report.
8. Show Novus events for the funnel.

Hard product line: the user-uploaded plan is the source of geometry. Public London data is optional enrichment only.

## Architecture Commitments

- Runtime: Node 20+.
- Package manager: pnpm.
- Frontend: Next.js App Router, TypeScript, Tailwind, shadcn/ui.
- 2D editor: react-konva and konva.
- 3D renderer: three, @react-three/fiber, @react-three/drei.
- State: zustand.
- Database: Supabase Postgres or Neon Postgres; default to Supabase-ready Prisma.
- Storage: Supabase Storage or local dev fallback.
- AI: Fireworks through `packages/ai/provider.ts`.
- Events: Novus plus local `trackEvent` wrapper and `EventLog`.
- Deployment: Vercel for web; optional Python CV worker only after the web MVP is solid.

Required resilience:

- Parser failure must route to manual trace.
- Fireworks failure must return deterministic variants.
- PDF failure must allow PNG/JPG and sample plan.
- 3D openings can be markers before real boolean cutouts.

## Recommended Build Strategy

Do not start six agents against an empty folder. This directory currently contains the spec and execution docs only, so the first thread must create the foundation and initial commit. After foundation exists, run parallel workstreams.

Stage 0: Bootstrap repository

- Initialize the monorepo and Git repository if absent.
- Create core package layout, root scripts, formatting, linting, and TypeScript setup.
- Commit a stable base before parallel work starts.

Stage 1: Foundation vertical scaffold

- Next.js app boots.
- Placeholder routes exist.
- Shared plan and variant schemas exist.
- Prisma schema exists.
- Sample London flat fixture exists.
- Event wrapper exists.

Stage gate A:

- `pnpm install` completed.
- `pnpm lint` passes or has documented, scoped failures.
- `pnpm typecheck` passes.
- `pnpm dev` starts.

Stage 2: Visual demo spine

- `/demo/london-flat` loads fixture.
- 2D plan view displays the sample.
- "Generate 3D" renders nonblank 3D scene.
- Orbit controls work.
- Variant switching visibly changes materials/furniture.

Stage gate B:

- Playwright or browser verification confirms demo path.
- Canvas is nonblank.
- No blocking console/runtime errors.

Stage 3: Product breadth

- Upload PNG/JPG/PDF path exists.
- Manual trace mode exists.
- Plan save/load works.
- Fireworks variant generation and deterministic fallback work.
- Share/report pages exist.
- Novus/events proof page exists.

Stage gate C:

- Sample full funnel creates events.
- Public share page loads without login.
- `pnpm build` passes.

Stage 4: Submission readiness

- Public deployment.
- Demo video script.
- Novus screenshot instructions/proof.
- Submission description.
- Final smoke test on deployed URL.

## Master Overnight Goal

Use this for one long sequential session after reading the spec:

```text
/goal Build RenovationTwin to hackathon-demo readiness from the current workspace.

First read `AGENTS.md`, `codex_execution_source_of_truth.md`, and `renovation_twin_build_ready_spec.md`. Treat those as the source of truth.

Work in stages with verification gates:

1. Bootstrap/foundation: if this is not already a Git repo and monorepo, create the Next.js App Router pnpm monorepo with TypeScript, Tailwind, shadcn/ui-ready structure, Prisma/Supabase-ready envs, shared PlanSchema and DesignVariantSchema, event names/wrapper, sample London flat fixture, and placeholder routes from the spec.
2. Verify foundation with install, lint, typecheck, and dev boot. Fix failures before continuing unless the failure is external and documented.
3. Build the visual demo spine: `/demo/london-flat`, 2D sample plan view/manual-edit foundation, `Generate 3D`, React Three Fiber scene from PlanSchema, orbit controls, procedural furniture, and two deterministic variants.
4. Verify the demo spine with browser/Playwright checks, including a nonblank 3D canvas and no blocking runtime errors.
5. Build product breadth: upload PNG/JPG/PDF first-page handling with manual fallback, plan save/load, Fireworks-backed variant API with deterministic fallback, report/share pages, event tracking, and `/novus-proof`.
6. Verify breadth with lint, typecheck, build, and an end-to-end sample flow. Add or fix tests where they protect shared contracts.
7. Prepare submission readiness: demo script, deployment notes, env checklist, Novus proof checklist, and final handoff.

Prioritize the sample London flat path and public demo reliability over perfect floor-plan parsing. Do not claim CAD accuracy, structural feasibility, planning permission advice, automatic reconstruction from address, or contractor-grade estimates. Keep sensitive content out of events and AI calls. If a required external service is unavailable, add a deterministic fallback and continue.

Completion criteria: a stranger can open the app, run the sample demo without login, see a 3D model, switch variants, create a share/report page, and see tracked events. End with changed files, commands run, remaining risks, and exact next actions.
```

## Parallel Thread Plan

Run this only after Stage 1 foundation is complete and committed. Use one thread per branch/worktree. Keep each thread's ownership narrow.

### Thread A: 2D Plan Editor

Owns:

- `apps/web/components/plan-editor/**`
- `apps/web/app/projects/[projectId]/plan/**`

Goal:

```text
/goal Build the 2D floor plan editor for RenovationTwin.

Read `AGENTS.md`, `codex_execution_source_of_truth.md`, and `renovation_twin_build_ready_spec.md`. Use existing shared types without changing them unless absolutely necessary.

Implement a react-konva editor that displays the plan image, supports wall drawing/editing, door/window markers, room labels, scale line calibration, validation for at least 4 walls plus scale, and save/load through the existing API or fixture fallback.

Verify with lint/typecheck and a manual or Playwright sample flow. Done when a user can create or edit a simple room and save valid PlanSchema JSON.
```

### Thread B: 3D Renderer

Owns:

- `apps/web/components/three/**`
- `packages/geometry/**`
- `apps/web/app/projects/[projectId]/model/**`
- `apps/web/app/demo/london-flat/**` only for renderer wiring

Goal:

```text
/goal Build the 3D renderer and walkthrough for RenovationTwin.

Read the source-of-truth docs. Implement PlanSchema-to-3D conversion, wall meshes, floor plane, opening markers, room labels toggle, procedural furniture, orbit controls, and variant material/furniture application. Use the sample London flat fixture as the primary test input.

Verify the canvas is nonblank and interactive with browser/Playwright checks. Done when the sample plan renders as a navigable 3D model and variant JSON visibly changes the scene.
```

### Thread C: Upload And Parser

Owns:

- upload routes/APIs
- PDF/image handling code
- optional `apps/cv-worker/**`

Goal:

```text
/goal Implement upload and parser fallback for RenovationTwin.

Read the source-of-truth docs. Implement PNG/JPG/PDF upload, first-page PDF rendering where practical, storage through Supabase-ready or local dev fallback, and a parser endpoint that returns editable wall proposals when possible. Parser failure must always route to manual tracing.

Verify uploaded files appear in the editor and failures do not block manual editing. Done when upload-to-editor works for an image and PDF handling has either a working implementation or a clear fallback.
```

### Thread D: AI Variants

Owns:

- `packages/ai/**`
- variant API
- design variant UI

Goal:

```text
/goal Implement Fireworks-backed renovation variants for RenovationTwin.

Read the source-of-truth docs. Add a provider wrapper for Fireworks OpenAI-compatible JSON generation, Zod validation for DesignVariantSchema, style presets, prompt UI, and deterministic fallback variants when Fireworks or env vars are unavailable.

Verify valid and invalid AI JSON paths. Done when the app can generate at least two variants and apply them to the renderer contract.
```

### Thread E: Events, Report, Demo Polish

Owns:

- `packages/events/**`
- `/novus-proof`
- report/share pages
- demo script docs
- event wiring through existing callbacks

Goal:

```text
/goal Implement event tracking, Novus proof, reports, share pages, and demo polish for RenovationTwin.

Read the source-of-truth docs. Wire required events for project create, upload, parse, manual edit, scale confirm, plan confirm, model generate, variant prompt, variant generate, walkthrough, share, and export. Build `/novus-proof`, share/report pages, and a concise demo script.

Do not rewrite the editor or renderer except to call existing event hooks. Verify the sample funnel creates visible events and the public share page works without login.
```

## Merge And Verification Protocol

1. Merge foundation first.
2. For each thread, inspect changed files and confirm ownership boundaries.
3. Run `pnpm lint` and `pnpm typecheck` after each merge.
4. Run targeted tests for the merged slice.
5. After editor plus renderer merges, run the sample demo in browser.
6. After upload, AI, and events/report merges, run the full sample funnel.
7. Before final deploy, run `pnpm build` and a deployed smoke test.

If two branches conflict in shared contracts, preserve the schema that best matches `renovation_twin_build_ready_spec.md`, then adapt feature code around it.

## Practical Codex Guidance

- Use `/goal` for the master overnight task because it gives Codex a persistent objective and completion criteria.
- Use `/plan` first when the task is still ambiguous.
- Do not rely on `/loop` unless the current Codex surface explicitly lists it. Official Codex docs describe Codex working in a loop internally, but `/loop` is not listed as a standard app slash command in the checked docs.
- Use `AGENTS.md` for durable repo guidance and this file for product-specific execution state.
- Use parallel threads only after ownership boundaries are clear. Avoid multiple agents writing the same shared config or schema files.
- For long tasks, make verification explicit. "Done" means behavior works and checks ran, not merely that files changed.
