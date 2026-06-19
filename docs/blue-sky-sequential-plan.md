# RenovationTwin Blue Sky Sequential Plan

This document is the source of truth for the next Blue Sky build wave after commit `b6f9ff5`.
Use it alongside:

- `AGENTS.md`
- `codex_execution_source_of_truth.md`
- `renovation_twin_build_ready_spec.md`
- `docs/architecture.md`

Submission packaging is intentionally out of scope for this wave. The goal is to turn the current
demo spine into a more credible product.

## Current Baseline

Already working:

- Next.js app scaffold with sample London flat route.
- 2D plan editor with floor plan background, wall drawing/editing, numeric scale, and save-before-3D.
- 3D React Three Fiber model with orbit controls, room-label toggle, opening markers, furniture, and variant switching.
- Upload route with manual fallback preview.
- Fireworks-backed variant API with deterministic fallback.
- Report/share flow and public share page.
- Local event tracking and `/novus-proof`.
- E2E coverage for model, plan editor, upload fallback, variant/report/share/proof.

Known product gaps:

- Project/share state is in-memory and not durable.
- PDF first-page rendering is not truly implemented.
- Parser returns fallback proposals rather than useful wall proposals.
- Editor lacks scale-line calibration, door/window placement, room editing, snapping, and undo/redo.
- 3D is orbit-first, not guided or first-person walkthrough.
- Report/share pages are functional but thin; they need screenshots and clearer deliverable structure.
- AI variants need stronger product inputs, validation, and intent-based explanations.

## Blue Sky Target

End state for this wave:

1. Projects, plans, variants, share tokens, and event logs persist through an adapter boundary.
2. Upload supports image preview reliably and either renders PDF first page or gives a clear user-facing fallback.
3. Parser endpoint can return a low-confidence wall proposal for simple plans and always falls back to manual trace.
4. Plan editor supports scale-line calibration, door/window placement, room labels, snapping, undo/redo, and valid saves.
5. 3D/report flow supports camera presets, screenshot capture, variant comparison, and a polished public report.
6. AI variants support intent controls and cannot break the renderer if model output is invalid.
7. The existing sample path remains fast and reliable without external services.

## Sequencing

Prefer one long sequential goal or two sequential goals. Avoid parallel work unless the codebase has a fresh stable commit between sessions.

Recommended two-goal split:

- Goal 1: Product foundation and plan intelligence.
- Goal 2: Visual deliverable and AI depth.

Use one mega goal only if the agent can run for a long time and keep a single coherent plan.

## Stage Gates

At the end of every stage:

- Run `pnpm lint`.
- Run `pnpm typecheck`.
- Run targeted tests for touched behavior.
- If UI changed, run `python3 /Users/abhinavgupta/.codex/skills/webdesign/scripts/website_quality_audit.py apps/web`.
- Run `pnpm build` after major route/API changes.
- Run `pnpm test:e2e` after user-flow changes.

Do not continue to the next stage with failing checks unless the failure is external, documented, and does not affect the next stage.

## Guardrails

- Preserve the sample London flat path.
- Preserve deterministic fallbacks.
- Do not send uploaded floor plans, PDFs, raw images, addresses, or sensitive content to AI or analytics.
- Do not claim CAD accuracy, structural feasibility, planning permission advice, or contractor-grade estimates.
- Keep API responses in `{ ok, data/error }` shape.
- Keep shared schema changes backwards compatible.
- Prefer adapter boundaries over scattering persistence logic through routes.

## One-Session Master Goal

```text
/goal Build the Blue Sky functionality wave for RenovationTwin sequentially from the current workspace.

Before editing, create your own isolated git worktree or branch, for example `.codex-worktrees/reno-blue-sky` on branch `agent/reno-blue-sky`. Do not work directly on main unless explicitly instructed.

Read `AGENTS.md`, `codex_execution_source_of_truth.md`, `renovation_twin_build_ready_spec.md`, `docs/architecture.md`, and `docs/blue-sky-sequential-plan.md`. Treat `docs/blue-sky-sequential-plan.md` as the operating plan for this goal.

Objective:
Turn the current demo spine into a more credible product by implementing durable project storage, upload/parser intelligence, editor v2 correction tools, 3D/report polish, and deeper AI variants while preserving all existing sample-demo behavior and fallbacks.

Work sequentially with gates:

Stage 1: Durability and storage adapter
- Inspect the current in-memory `apps/web/lib/server/project-store.ts`.
- Design and implement a storage adapter boundary.
- Align Prisma schema with projects, uploads, plan versions, variants, share tokens, and events.
- Use durable DB storage when configured and local fallback otherwise.
- Persist project create, upload, plan save, variant save, share token, report export, and event log.
- Verify create project -> save plan -> create share -> reload share by token.
- Gate: `pnpm lint`, `pnpm typecheck`, targeted persistence test, and `pnpm build`.

Stage 2: Upload and parser intelligence
- Improve image upload preview and plan-editor handoff.
- Implement PDF first-page rendering if practical; otherwise create a clear user-facing PDF fallback state and parser boundary.
- Add a lightweight parser proposal path for simple horizontal/vertical wall-like lines.
- Return valid `PlanSchema`, confidence, and warnings.
- Manual trace must always remain available.
- Gate: upload/parser targeted tests, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.

Stage 3: 2D editor v2
- Add scale-line calibration: draw a reference line and enter real length in metres.
- Add door/window placement tools attached to selected walls.
- Add room label creation/editing.
- Add snap-to-axis or endpoint snapping for wall drawing.
- Add undo/redo for manual edit operations.
- Save valid `PlanSchema` through the existing plan API.
- Gate: Playwright coverage for scale calibration, door/window placement, save, and generate 3D; plus lint/typecheck/build.

Stage 4: 3D walkthrough and report polish
- Add camera presets: overview, living, bedroom/office, and walkthrough/guided if feasible.
- Add screenshot capture for the 3D canvas.
- Use screenshots and floor-plan preview in report/share.
- Add variant comparison and clear "what changed" sections.
- Polish public share page into a read-only concept report.
- Gate: browser verification for nonblank canvas, camera preset changes, screenshot/report artifact, share page load, and no blocking console errors.

Stage 5: AI variant depth
- Add inputs for budget level, use intent, household type, and room priorities.
- Improve Fireworks prompt structure and Zod validation.
- Add deterministic fallbacks for multiple intents.
- Drop or warn on invalid furniture items that reference missing rooms.
- Show why each variant fits the selected intent.
- Gate: tests for Fireworks fallback, invalid AI JSON handling, renderer-safe variant output, lint/typecheck/build.

Final verification:
- Run `pnpm lint`.
- Run `pnpm typecheck`.
- Run `python3 /Users/abhinavgupta/.codex/skills/webdesign/scripts/website_quality_audit.py apps/web`.
- Run `pnpm build`.
- Run `pnpm test:e2e`.
- Add/update E2E tests so the new primary flow is covered.

Completion criteria:
A user can create or open a project, upload or use the sample plan, get a parser proposal or manual fallback, calibrate scale, add walls/openings/room labels, save the plan, view a 3D model, switch or generate intent-aware variants, capture/report screenshots, create a durable share link, and open a polished public report. Existing sample London flat demo still works without external services.

End with changed files, checks run, remaining risks, and exact follow-up recommendations.
```

## Two-Session Goal 1: Product Foundation And Plan Intelligence

```text
/goal Build RenovationTwin Blue Sky Goal 1: product foundation and plan intelligence.

Before editing, create your own isolated git worktree or branch, for example `.codex-worktrees/reno-blue-sky-foundation` on branch `agent/reno-blue-sky-foundation`. Do not work directly on main unless explicitly instructed.

Read `AGENTS.md`, `codex_execution_source_of_truth.md`, `renovation_twin_build_ready_spec.md`, `docs/architecture.md`, and `docs/blue-sky-sequential-plan.md`.

Objective:
Implement durable storage foundations, upload/parser intelligence, and editor v2 correction tools. Do not work on 3D/report/AI polish except where needed to keep flows passing.

Stage 1: Durable storage
- Add a project-store adapter boundary.
- Align Prisma schema with current ProjectRecord needs.
- Persist projects, uploads, plan versions, variants, share tokens, reports, and events when DB is configured.
- Preserve local fallback and sample fixture.
- Add targeted persistence verification.
- Gate: lint, typecheck, targeted test, build.

Stage 2: Upload and parser
- Improve image upload preview and plan-editor handoff.
- Implement PDF first-page rendering if practical, or a clear fallback state if not.
- Add parser proposal for simple plans using lightweight line detection or a clean optional worker boundary.
- Parser must return valid PlanSchema, confidence, and warnings.
- Manual trace must never be blocked.
- Gate: upload/parser tests, lint, typecheck, build.

Stage 3: Editor v2
- Add scale-line calibration.
- Add door/window placement on selected walls.
- Add room label creation/editing.
- Add snapping for wall drawing.
- Add undo/redo.
- Save valid PlanSchema and preserve Generate 3D behavior.
- Gate: Playwright test for calibration, opening placement, room label save, and generate 3D.

Final verification:
- `pnpm lint`
- `pnpm typecheck`
- `python3 /Users/abhinavgupta/.codex/skills/webdesign/scripts/website_quality_audit.py apps/web`
- `pnpm build`
- relevant `pnpm test:e2e`

Completion criteria:
The project foundation is durable or adapter-ready, upload/parser fallback is credible, and the editor can produce a richer valid plan with scale, walls, openings, and rooms. Existing sample demo remains green.
```

## Two-Session Goal 2: Visual Deliverable And AI Depth

Run after Goal 1 is merged and verified.

```text
/goal Build RenovationTwin Blue Sky Goal 2: visual deliverable and AI depth.

Before editing, create your own isolated git worktree or branch, for example `.codex-worktrees/reno-blue-sky-experience` on branch `agent/reno-blue-sky-experience`. Do not work directly on main unless explicitly instructed.

Read `AGENTS.md`, `codex_execution_source_of_truth.md`, `renovation_twin_build_ready_spec.md`, `docs/architecture.md`, and `docs/blue-sky-sequential-plan.md`. Assume Goal 1 has already landed.

Objective:
Upgrade the 3D walkthrough, report/share deliverable, and AI variant system into a more premium product experience.

Stage 1: 3D walkthrough polish
- Add camera presets for overview and key rooms.
- Add guided or first-person walkthrough mode if feasible.
- Preserve orbit controls and nonblank canvas behavior.
- Improve renderer safety for sparse/manual plans.
- Gate: browser/Playwright verifies camera changes and nonblank canvas.

Stage 2: Screenshot and report/share polish
- Add 3D screenshot capture.
- Add floor-plan preview, screenshot, variant comparison, and "what changed" sections to report/share.
- Make the public share page feel like a read-only concept report.
- Gate: E2E verifies screenshot/report artifact and public share page load.

Stage 3: AI variant depth
- Add inputs for budget, use intent, household type, and room priorities.
- Improve Fireworks prompt and validation.
- Add deterministic fallback variants for multiple intents.
- Sanitize invalid furniture placements so AI output cannot break the renderer.
- Show warnings and rationale for each variant.
- Gate: tests for fallback, invalid model output, and renderer-safe variant application.

Final verification:
- `pnpm lint`
- `pnpm typecheck`
- `python3 /Users/abhinavgupta/.codex/skills/webdesign/scripts/website_quality_audit.py apps/web`
- `pnpm build`
- `pnpm test:e2e`

Completion criteria:
A user can move from confirmed plan to a richer walkthrough, capture/report visuals, compare variants, create a durable/polished share report, and generate intent-aware variants with safe fallback behavior.
```
