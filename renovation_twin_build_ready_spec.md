# RenovationTwin Build-Ready Product and Implementation Specification

**Working title:** RenovationTwin  
**Tagline:** Upload a floor plan. Walk through your future renovation in 3D.  
**Primary hackathon:** Mind the Product World Product Day 2026  
**Document status:** Build-ready handoff for Codex/engineering agents.  
**Primary constraint:** Must be usable from a public deployed URL. No browser extension, no desktop app, no native install.

---

## 0. One-paragraph build instruction for coding agents

Build a public web app that converts a user-uploaded 2D floor plan into an editable browser-based 3D renovation walkthrough. The MVP must accept a PDF/PNG/JPG floor plan, extract or propose walls where possible, let the user correct walls/doors/windows/scale in a 2D editor, extrude the confirmed plan into a 3D model, generate two AI style/layout variants using Fireworks, and produce a shareable walkthrough/report. Do not promise address-to-perfect-home reconstruction. Treat public London planning data as optional enrichment only. Optimize for a polished demo: upload a sample London flat plan, confirm scale, generate 3D, switch between before/after variants, and walk through the model.

---

## 1. Hackathon fit and success criteria

### Why this can win

RenovationTwin has the highest visual wow factor of the shortlisted products. It is not a chatbot and not a dashboard. A judge sees an immediate transformation:

> A flat floor plan becomes a spatial model of a home that can be walked through and restyled.

It scores strongly on:

- **Product Thinking:** expensive, emotional, common decision: “what will this space look like if I renovate?”
- **Craft and Execution:** polished 2D-to-3D UX, editable plan, walkthrough, style variants.
- **Originality/Ambition:** browser-based spatial design from floor plan plus AI interior concepts.
- **Shippedness:** public URL, sample project, upload flow, shareable result, Novus installed.

### Definition of done for hackathon submission

A submission is complete only if all of the following work on the deployed URL:

1. User can create a new project without logging in.
2. User can upload a floor plan image or PDF.
3. User can use a sample floor plan if they do not have one.
4. App shows a 2D editor with proposed walls or a manual drawing mode.
5. User can set scale using a known measurement.
6. App generates a 3D model from the confirmed plan.
7. User can choose at least two design variants, e.g. “Warm Minimal” and “Family Rental Staging.”
8. User can walk/orbit through the 3D model in the browser.
9. User can export/share a project URL with screenshots and a design brief.
10. Novus is installed and the dashboard shows events for upload, parse, edit, generate, walkthrough, and export.

---

## 2. Product positioning

### User pain

Homeowners, renters, landlords, small contractors, and buyers struggle to visualize renovation/interior decisions before committing money. Static moodboards and Pinterest boards are not enough because they do not show the user’s own space. Formal CAD or designer renders are slow and expensive.

### Primary users

1. London homeowner considering a renovation or redecoration.
2. Buyer/renter trying to plan furniture before moving.
3. Small landlord or estate agent staging a unit.
4. Small contractor/designer creating a first concept for a client.

### Product promise

> Upload your floor plan and walk through renovation ideas in minutes.

### Non-goals

- Not structural engineering advice.
- Not planning permission advice.
- Not CAD-grade measurement output.
- Not an address-to-interior database.
- Not a replacement for architects or surveyors.

---

## 3. UK/London public data stance

### Use public data only as enrichment

For the MVP, the source of interior geometry is the uploaded floor plan. UK/London public data can enrich a project but cannot reliably provide internal layouts for arbitrary residential homes.

Supported enrichment in MVP or near-MVP:

- Postcode lookup via Postcodes.io for borough/coordinates.
- Optional London Planning Datahub/Planning Data API links for planning context.
- Optional OSM/building footprint display if time allows.

Do **not** build the core experience around automatically finding a house floor plan from address. It will fail too often and slow the build.

---

## 4. Core user journeys

### Journey A: fastest demo path

1. User clicks “Try sample London flat.”
2. App loads `/demo/london-flat` with sample plan image and pre-parsed wall proposal.
3. User clicks “Confirm scale.”
4. User clicks “Generate 3D.”
5. App shows the flat in 3D.
6. User selects “Warm Minimal” and “Rental Staging.”
7. App generates two variants.
8. User walks through and exports share link.

### Journey B: real user upload

1. User clicks “Start project.”
2. User uploads PDF/PNG/JPG floor plan.
3. If PDF, app extracts first page as image.
4. App runs plan parser and shows proposed walls/rooms.
5. User corrects walls/doors/windows and room names.
6. User draws a scale reference line and enters length in metres.
7. App extrudes 3D model.
8. User generates design variants.
9. User shares/export report.

### Journey C: manual fallback

1. Parser fails or confidence is low.
2. App shows “Manual trace mode.”
3. User draws walls over the image.
4. User adds doors/windows and room labels.
5. App proceeds exactly as above.

Manual fallback is mandatory. It prevents the demo from dying on floor plan parsing.

---

## 5. App routes and screens

Use Next.js App Router.

```txt
/                               Landing page
/demo                           Demo selector
/demo/london-flat               Preloaded sample project
/projects/new                   New project upload page
/projects/[projectId]/upload    Upload and PDF/image preview
/projects/[projectId]/plan      2D plan editor and scale calibration
/projects/[projectId]/model     3D extrusion/walkthrough
/projects/[projectId]/design    AI design variant generator
/projects/[projectId]/report    Shareable design report
/projects/[projectId]/share     Public read-only share page
/settings/privacy               Privacy and data deletion
/novus-proof                    Page showing events tracked for submission
```

### Screen-level requirements

#### Landing

- Headline: “Upload a floor plan. Walk through your future renovation.”
- CTA: “Try sample flat” and “Upload your plan.”
- 3-step explanation: Upload, Correct, Walkthrough.

#### Upload

- Drag/drop zone for PNG/JPG/PDF.
- Sample floor plan button.
- Optional postcode/address field.
- Clear disclaimer: “Concept visualisation only. Not architectural/structural advice.”

#### 2D Plan Editor

Must include:

- floor plan image as background;
- wall drawing/editing;
- door/window placement;
- room labels;
- scale line tool;
- parse confidence indicator;
- “Generate 3D” button disabled until scale and at least 4 walls exist.

Recommended library: `react-konva` for 2D canvas.

#### 3D Model

Must include:

- orbit controls;
- first-person/walkthrough mode if time allows;
- wall/floor rendering;
- doors/windows cutouts or simplified markers;
- room labels toggle;
- before/after variant switcher.

Recommended library: `three`, `@react-three/fiber`, `@react-three/drei`.

#### Design Variant

- Prompt input: “Make this a warm Japandi living room and home office.”
- Style preset buttons.
- Variant cards with palette, furniture list, room-by-room changes.
- Apply variant to 3D scene.

#### Report

- Project summary.
- Floor plan screenshot.
- 3D screenshots.
- Before/after variant notes.
- “What changed” list.
- Share link.

---

## 6. Tech stack

### Required

```txt
Runtime: Node 20+
Package manager: pnpm
Frontend: Next.js App Router, TypeScript, Tailwind, shadcn/ui
2D editor: react-konva, konva
3D renderer: three, @react-three/fiber, @react-three/drei
State: zustand
Database: Supabase Postgres or Neon Postgres
Storage: Supabase Storage or Cloudflare R2
ORM: Prisma or Drizzle; use Prisma if no strong preference
AI provider: Fireworks via /packages/ai/provider.ts
PDF/image handling: pdfjs-dist for PDF page render, sharp for server image tasks if supported
CV worker: optional Python FastAPI worker with opencv-python-headless and Pillow
Analytics: Novus install + custom trackEvent wrapper
Deployment: Vercel for web, Render/Fly/Railway for optional Python worker
```

### Recommended repo structure

```txt
renovation-twin/
  apps/
    web/
      app/
      components/
      lib/
      public/
    cv-worker/                 # optional, can be added after web MVP
      app.py
      requirements.txt
  packages/
    types/
      plan.ts
      api.ts
    db/
      prisma/schema.prisma
      client.ts
    ai/
      provider.ts
      prompts.ts
      schemas.ts
    events/
      track.ts
      event-names.ts
    geometry/
      plan-to-3d.ts
      wall-mesh.ts
      room-utils.ts
    fixtures/
      sample-plans/
      sample-projects/
  docs/
    build-spec.md
    demo-script.md
```

### Environment variables

```bash
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=renovation-twin
FIREWORKS_API_KEY=
FIREWORKS_MODEL=
NEXT_PUBLIC_APP_URL=
CV_WORKER_URL=       # optional
NOVUS_*              # generated by Novus install PR
```

---

## 7. Data model

Use anonymous sessions first. Authentication is optional and should not block the MVP.

### Prisma schema outline

```prisma
model Project {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  title           String
  status          ProjectStatus @default(DRAFT)
  anonymousUserId String?
  postcode        String?
  addressLabel    String?
  planImageUrl    String?
  originalFileUrl String?
  scalePxPerMeter Float?
  currentPlanId   String?
  shareToken      String? @unique
  events          EventLog[]
  planVersions    PlanVersion[]
  variants        DesignVariant[]
}

enum ProjectStatus {
  DRAFT
  UPLOADED
  PARSED
  PLAN_CONFIRMED
  MODEL_GENERATED
  VARIANTS_GENERATED
  SHARED
}

model PlanVersion {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
  version   Int
  source    PlanSource
  confidence Float?
  planJson  Json
  createdAt DateTime @default(now())
}

enum PlanSource {
  AUTO_PARSE
  MANUAL_EDIT
  SAMPLE
}

model DesignVariant {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  name        String
  prompt      String
  style       String
  variantJson Json
  screenshotUrl String?
  createdAt   DateTime @default(now())
}

model EventLog {
  id        String   @id @default(cuid())
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id])
  name      String
  props     Json?
  createdAt DateTime @default(now())
}
```

### Plan JSON schema

Define in `packages/types/plan.ts` and validate with Zod.

```ts
export type Vec2 = { x: number; y: number };

export type Wall = {
  id: string;
  start: Vec2;
  end: Vec2;
  thicknessM: number;
  heightM: number;
  roomIds?: string[];
};

export type Opening = {
  id: string;
  type: 'door' | 'window';
  wallId: string;
  offsetM: number;
  widthM: number;
  heightM: number;
  sillHeightM?: number;
};

export type Room = {
  id: string;
  label: string;
  polygon: Vec2[];
  areaM2?: number;
  floorMaterial?: string;
};

export type PlanSchema = {
  units: 'm';
  scalePxPerMeter: number;
  image: { widthPx: number; heightPx: number; url: string };
  walls: Wall[];
  openings: Opening[];
  rooms: Room[];
};

export type FurnitureItem = {
  id: string;
  assetId: string;
  roomId: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  scale: { x: number; y: number; z: number };
  color?: string;
};

export type DesignVariantSchema = {
  name: string;
  style: string;
  palette: { wall: string; floor: string; accent: string; textile: string };
  roomNotes: Array<{ roomId: string; summary: string; changes: string[] }>;
  furniture: FurnitureItem[];
  warnings: string[];
};
```

---

## 8. API contracts

All APIs return `{ ok: boolean, data?: T, error?: { code: string, message: string } }`.

### Project APIs

```txt
POST /api/projects
Body: { title?: string, postcode?: string }
Returns: { projectId: string }

POST /api/projects/:id/upload-floorplan
Multipart: file
Returns: { fileUrl, planImageUrl, imageWidth, imageHeight }

POST /api/projects/:id/parse-plan
Body: { planImageUrl: string }
Returns: { planProposal: PlanSchema, confidence: number, warnings: string[] }

PUT /api/projects/:id/plan
Body: { plan: PlanSchema }
Returns: { planVersionId: string }

POST /api/projects/:id/generate-variant
Body: { prompt: string, stylePreset?: string, plan: PlanSchema }
Returns: { variantId: string, variant: DesignVariantSchema }

POST /api/projects/:id/share
Returns: { shareUrl: string }

GET /api/share/:token
Returns: public read-only report data
```

### Public data APIs

```txt
POST /api/public-data/postcode
Body: { postcode: string }
Returns: { borough, coordinates, adminDistrict, planningLinks? }
```

### Analytics API

```txt
POST /api/events
Body: { name: EventName, projectId?: string, props?: Record<string, unknown> }
Returns: { ok: true }
```

---

## 9. Floor plan parsing implementation

### Required parser behavior

The parser should output a proposal, not truth. Every proposal must be editable.

#### MVP parser levels

Level 0, always available:

- Load sample project with prebuilt `PlanSchema`.
- Manual tracing from blank/wall tool.

Level 1, required for upload flow:

- Extract PDF first page to image.
- Display image.
- Allow manual trace.

Level 2, should ship if time:

- Use OpenCV edge/line detection to propose walls.
- Run line-merging heuristics.
- Output walls with confidence.

Level 3, optional:

- Use OCR/VLM to detect room labels.
- Use AI to infer room types.

### Python CV worker outline

`apps/cv-worker/app.py`

```python
from fastapi import FastAPI, UploadFile
from pydantic import BaseModel
import cv2
import numpy as np

app = FastAPI()

class ParseResponse(BaseModel):
    walls: list
    openings: list
    rooms: list
    confidence: float
    warnings: list[str]

@app.post('/parse-plan')
async def parse_plan(file: UploadFile) -> ParseResponse:
    # 1. Read image bytes
    # 2. Convert to grayscale
    # 3. Adaptive threshold
    # 4. Morphological close/open to emphasize thick plan lines
    # 5. HoughLinesP for long horizontal/vertical line segments
    # 6. Merge collinear nearby segments
    # 7. Normalize to image coordinates
    # 8. Return walls as proposal, with no rooms if unsure
    return ParseResponse(walls=[], openings=[], rooms=[], confidence=0.0, warnings=['Parser fallback not implemented'])
```

Do not spend too long perfecting CV. The demo can win with manual correction and a polished 3D walkthrough.

---

## 10. 3D generation implementation

### Wall extrusion

`packages/geometry/plan-to-3d.ts`

- Convert each wall from 2D plan coordinates to metres using `scalePxPerMeter`.
- For each wall, compute direction vector and perpendicular normal.
- Create rectangular prism geometry with thickness and height.
- Doors/windows can initially be markers or transparent rectangles; true boolean cutouts are optional.

### Scene composition

Components:

```txt
<PlanScene>
  <FloorPlane />
  <WallMesh wall={wall} />
  <OpeningMarker opening={opening} />
  <RoomLabel />
  <FurnitureMesh />
  <CameraControls />
  <VariantMaterialController />
</PlanScene>
```

### Furniture strategy

Use procedural primitives first:

- sofa = boxes with rounded-ish proportions;
- bed = box + pillow boxes;
- table = box + legs;
- chair = box + legs/back;
- rug = flat plane;
- plant = cylinder + sphere.

Do not depend on external GLTF assets in the MVP unless already downloaded into `/public/assets/furniture`.

---

## 11. Fireworks AI usage

Use Fireworks for design reasoning, not for core geometry.

### Provider wrapper

`packages/ai/provider.ts`

```ts
export async function runJsonModel<T>({
  system,
  user,
  schemaName,
  schema,
}: {
  system: string;
  user: string;
  schemaName: string;
  schema: unknown;
}): Promise<T> {
  // Call Fireworks OpenAI-compatible endpoint.
  // Validate result with Zod before returning.
}
```

### Design prompt intent

Input:

- confirmed `PlanSchema`;
- user prompt;
- style preset;
- optional room photos later.

Output:

- palette;
- room-by-room plan;
- furniture placement;
- warnings about unrealistic changes;
- shareable design narrative.

### Guardrails

The AI may suggest “remove wall” as a concept, but the UI must label structural changes as conceptual only:

> “Structural feasibility must be checked by a qualified professional.”

---

## 12. Novus and analytics plan

Install Novus immediately after routes and main components exist. Use a local wrapper so events are consistent.

`packages/events/event-names.ts`

```ts
export const Events = {
  ProjectCreated: 'project_created',
  FloorplanUploaded: 'floorplan_uploaded',
  PdfRendered: 'pdf_rendered',
  PlanParseStarted: 'plan_parse_started',
  PlanParseCompleted: 'plan_parse_completed',
  ManualEditStarted: 'manual_edit_started',
  ScaleConfirmed: 'scale_confirmed',
  PlanConfirmed: 'plan_confirmed',
  ModelGenerated: 'model_generated',
  VariantPromptSubmitted: 'variant_prompt_submitted',
  VariantGenerated: 'variant_generated',
  WalkthroughStarted: 'walkthrough_started',
  ShareCreated: 'share_created',
  ReportExported: 'report_exported',
} as const;
```

Event properties must not include raw plan images, address, or user-uploaded file contents. Use counts and states:

```ts
trackEvent(Events.PlanParseCompleted, {
  projectId,
  wallCount,
  roomCount,
  confidenceBand: 'low' | 'medium' | 'high',
  usedFallback: boolean,
});
```

`/novus-proof` page should show:

- funnel: upload → parse/edit → 3D → variant → share;
- event table from `EventLog`;
- screenshot placeholder/instructions for Novus dashboard.

---

## 13. Security, privacy, and compliance

- Uploaded plans are private by default.
- Share pages require unguessable `shareToken`.
- Delete project endpoint must remove DB rows and storage objects.
- Do not send floor plan images to third-party AI providers unless user clicks “Use AI to interpret this plan.”
- For MVP, Fireworks should receive structured plan JSON, not raw home address or personal details.
- Add a privacy line: “Do not upload documents containing sensitive personal information.”

---

## 14. Demo data and sample project

Create `packages/fixtures/sample-projects/london-flat.json` with:

- 2-bedroom flat plan schema;
- living room, kitchen, bedroom, bathroom, hallway;
- 10-16 walls;
- 3 doors;
- 3 windows;
- 2 design variants.

Create sample assets:

```txt
/public/demo/floorplans/london-flat.png
/public/demo/screenshots/london-flat-before.png
/public/demo/screenshots/london-flat-warm-minimal.png
```

The demo must work offline from fixtures even if Fireworks or parser fails.

---

## 15. Acceptance tests

### Unit tests

- Plan schema validates valid sample.
- Wall extrusion returns non-empty geometry data.
- Scale conversion maps pixels to metres correctly.
- Variant schema validation rejects invalid AI JSON.

### E2E tests

Using Playwright:

1. Open `/demo/london-flat`.
2. Click “Generate 3D.”
3. Confirm canvas renders.
4. Select design variant.
5. Click share.
6. Public share page loads.

### Manual demo acceptance

- 3D model appears within 5 seconds for sample plan.
- Variant switch visibly changes materials/furniture.
- Walkthrough/orbit works smoothly.
- Share page can be opened in incognito.

---

## 16. Parallel Codex workstreams

### Merge strategy

1. Create branch `main` with root monorepo scaffold and shared package interfaces first.
2. Each Codex agent works on a separate branch and owns specific folders.
3. Do not let multiple agents edit `package.json`, Prisma schema, global Tailwind config, or shared type files after foundation unless explicitly coordinated.
4. Merge order: foundation → DB/API → UI editor → 3D renderer → AI variants → analytics → demo polish.

### Workstream A: Foundation and repo scaffold

**Branch:** `agent/reno-foundation`  
**Owns:** root files, `apps/web`, `packages/types`, `packages/db`, `packages/events`, Tailwind, shadcn setup.  
**Goal command:**

> Create the RenovationTwin monorepo scaffold with Next.js App Router, TypeScript, Tailwind, shadcn/ui, Prisma, Supabase-ready env, shared PlanSchema types, EventLog schema, and placeholder routes listed in the spec. Do not implement 2D/3D UI beyond placeholders. Ensure `pnpm lint`, `pnpm typecheck`, and `pnpm dev` run.

**Acceptance:** app boots, routes exist, Prisma schema compiles, sample event logging function exists.

### Workstream B: 2D plan editor

**Branch:** `agent/reno-plan-editor`  
**Owns:** `apps/web/components/plan-editor/**`, `/projects/[id]/plan`, `packages/types/plan.ts` only by import, not editing.  
**Goal command:**

> Build the 2D floor plan editor using react-konva. It must display a plan image, allow drawing/editing walls, placing doors/windows, adding room labels, drawing a scale line, and saving a valid PlanSchema through the provided API. Use sample project data if backend is unavailable.

**Acceptance:** user can create a simple room manually and save plan JSON.

### Workstream C: 3D renderer and walkthrough

**Branch:** `agent/reno-3d-renderer`  
**Owns:** `apps/web/components/three/**`, `packages/geometry/**`, `/projects/[id]/model`.  
**Goal command:**

> Build the React Three Fiber renderer that converts PlanSchema into wall meshes, floor plane, opening markers, room labels, simple procedural furniture, orbit controls, and variant material application. Use the sample London flat fixture as the main test input.

**Acceptance:** sample plan renders as a navigable 3D model; variant JSON changes colors/furniture.

### Workstream D: Upload and parser integration

**Branch:** `agent/reno-upload-parser`  
**Owns:** upload APIs, PDF rendering, optional `apps/cv-worker/**`.  
**Goal command:**

> Implement floor plan upload for PNG/JPG/PDF. Render first PDF page to an image. Add a parser endpoint that returns a wall proposal if possible and falls back to manual tracing. Store files in Supabase Storage or local dev storage.

**Acceptance:** uploaded file appears in editor; parser failure still allows manual editing.

### Workstream E: AI design variants

**Branch:** `agent/reno-ai-variants`  
**Owns:** `packages/ai/**`, `/api/projects/[id]/generate-variant`, design UI.  
**Goal command:**

> Implement Fireworks-backed JSON generation for design variants. Given PlanSchema and user prompt, return a validated DesignVariantSchema with palette, room notes, furniture placements, and warnings. Include deterministic fallback variants if Fireworks is unavailable.

**Acceptance:** design variants generate and can be applied to 3D renderer.

### Workstream F: Novus/events/report/demo polish

**Branch:** `agent/reno-analytics-demo`  
**Owns:** `packages/events/**`, `/novus-proof`, report/share pages, demo script docs.  
**Goal command:**

> Implement trackEvent wrapper, wire all required event names into user flows, build `/novus-proof`, implement share/report pages, and add sample London flat demo path. Do not edit core editor or renderer except to add event calls through existing props/callbacks.

**Acceptance:** event log shows complete funnel for sample demo; share page works.

---

## 17. Implementation schedule

### Day/night 1

- Foundation scaffold.
- Sample project fixture.
- 2D editor basic wall drawing.
- 3D renderer from fixture.

### Day/night 2

- Upload flow.
- Plan save/load.
- Variant generation.
- Share/report pages.
- Novus install.

### Final polish

- Demo script.
- Failure fallback paths.
- Screenshot/export.
- Novus screenshot.
- 2-3 minute video.

---

## 18. Fallbacks and hard lines

### Fallbacks

- If parser fails, manual trace is the product.
- If Fireworks fails, use deterministic variants.
- If 3D cutouts are hard, doors/windows become markers.
- If PDF rendering fails, ask user to upload PNG/JPG and provide sample plan.

### Hard lines

Do not claim:

- CAD accuracy;
- structural feasibility;
- planning permission assessment;
- automatic reconstruction from address;
- contractor-grade cost estimates.

---


## Shared source and platform assumptions

These specs assume the following current platform constraints and capabilities:

- The Mind the Product submission must be a public deployed URL with Novus installed and a Novus dashboard screenshot. The Chrome-extension path is intentionally not used for these three product specs.
- Fireworks is the default model provider. All AI calls must go through a provider wrapper so the model can be swapped without touching product code.
- Novus/Pendo instrumentation must never receive raw health data, home floor plans, uploaded PDFs, medical text, or secret target URLs unless explicitly anonymized. Track events and state transitions, not sensitive content.
- Vercel + Supabase + Fireworks credits are the default low-cost stack. Browser execution for SwarmProof is the only likely non-free dependency unless a self-hosted worker is used.

Reference URLs for implementers:

- Novus/Pendo product memory: https://www.pendo.io/pendo-blog/introducing-novus//
- Fireworks docs: https://docs.fireworks.ai/getting-started/introduction
- Fireworks pricing: https://docs.fireworks.ai/serverless/pricing
- React Three Fiber docs: https://r3f.docs.pmnd.rs/getting-started/introduction
- Stagehand docs: https://stagehand.dev/
- Playwright trace viewer: https://playwright.dev/docs/trace-viewer
- ICO special category data: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/
- MHRA software and AI as medical device: https://www.gov.uk/government/publications/software-and-artificial-intelligence-ai-as-a-medical-device/software-and-artificial-intelligence-ai-as-a-medical-device
- London Planning Datahub: https://www.london.gov.uk/programmes-strategies/planning/digital-planning/planning-london-datahub
- Planning Data API: https://www.planning.data.gov.uk/docs
- Postcodes.io: https://postcodes.io/docs/api/
