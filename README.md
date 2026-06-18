# RenovationTwin

Upload a floor plan. Walk through your future renovation in 3D.

This repository is scaffolded for the Mind the Product World Product Day 2026 hackathon. The product and execution sources of truth are:

- `renovation_twin_build_ready_spec.md`
- `codex_execution_source_of_truth.md`
- `AGENTS.md`

## Quick Start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` and use the sample London flat path first.

## Main Apps And Packages

- `apps/web`: Next.js App Router application.
- `packages/types`: shared Zod schemas and TypeScript types.
- `packages/fixtures`: deterministic sample London flat project and variants.
- `packages/geometry`: plan-to-3D geometry helpers.
- `packages/ai`: Fireworks provider wrapper and fallback variants.
- `packages/events`: event names and tracking wrapper.
- `packages/db`: Prisma schema and client.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm build
```
