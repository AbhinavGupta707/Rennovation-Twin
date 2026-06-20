import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getPrismaClient } from "@renovation-twin/db";
import { londonFlatPlan, londonFlatVariants } from "@renovation-twin/fixtures";
import {
  Events,
  trackEvent,
  type EventName,
  type EventProps,
  type TrackedEvent,
} from "@renovation-twin/events";
import type {
  DesignVariantSchema,
  PlanSchema,
  Wall,
} from "@renovation-twin/types";

export type UploadRecord = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  planImageUrl: string;
  imageWidth: number;
  imageHeight: number;
  previewKind?: "image" | "pdf-rendered" | "pdf-fallback";
  createdAt: string;
};

export type PlanVersionRecord = {
  id: string;
  version: number;
  source: "AUTO_PARSE" | "MANUAL_EDIT" | "SAMPLE";
  confidence?: number;
  plan: PlanSchema;
  createdAt: string;
};

export type ReportExportRecord = {
  id: string;
  createdAt: string;
  screenshotId?: string;
};

export type ProjectScreenshotRecord = {
  id: string;
  kind: "MODEL_VIEW";
  imageDataUrl: string;
  variantName?: string;
  cameraPreset?: string;
  createdAt: string;
};

export type ProjectStatus =
  | "DRAFT"
  | "UPLOADED"
  | "PARSED"
  | "PLAN_CONFIRMED"
  | "MODEL_GENERATED"
  | "VARIANTS_GENERATED"
  | "SHARED";

export type ProjectRecord = {
  id: string;
  title: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  postcode?: string;
  plan: PlanSchema;
  uploads: UploadRecord[];
  variants: DesignVariantSchema[];
  planVersions: PlanVersionRecord[];
  reportExports: ReportExportRecord[];
  screenshots: ProjectScreenshotRecord[];
  shareToken?: string;
};

type StoreShape = {
  projects: ProjectRecord[];
  shareTokens: Record<string, string>;
  events: TrackedEvent[];
};

type RuntimeStore = {
  projects: Map<string, ProjectRecord>;
  shareTokens: Map<string, string>;
  events: TrackedEvent[];
};

type ProjectStoreAdapter = {
  mode: "json-file" | "prisma";
  read(): Promise<RuntimeStore>;
  write(store: RuntimeStore): Promise<void>;
};

const globalStore = globalThis as unknown as {
  renovationTwinStorePromise?: Promise<RuntimeStore>;
  renovationTwinStoreAdapter?: ProjectStoreAdapter;
};

async function getStore(): Promise<RuntimeStore> {
  const adapter = getAdapter();

  if (adapter.mode === "prisma") {
    const store = await adapter.read();
    seedDemoProject(store);
    return store;
  }

  if (!globalStore.renovationTwinStorePromise) {
    globalStore.renovationTwinStorePromise = adapter.read();
  }

  const store = await globalStore.renovationTwinStorePromise;
  seedDemoProject(store);
  return store;
}

function getAdapter(): ProjectStoreAdapter {
  if (!globalStore.renovationTwinStoreAdapter) {
    globalStore.renovationTwinStoreAdapter = shouldUsePrismaStore()
      ? new PrismaProjectStoreAdapter()
      : new JsonFileProjectStoreAdapter(getStoreFilePath());
  }

  return globalStore.renovationTwinStoreAdapter;
}

function shouldUsePrismaStore() {
  return process.env.RENOVATION_TWIN_STORE_ADAPTER === "prisma";
}

function getStoreFilePath() {
  return (
    process.env.RENOVATION_TWIN_STORE_PATH ??
    join(process.cwd(), ".renovation-twin-store", "project-store.json")
  );
}

async function persistStore(store?: RuntimeStore) {
  const nextStore = store ?? (await getStore());
  await getAdapter().write(nextStore);
}

class JsonFileProjectStoreAdapter implements ProjectStoreAdapter {
  mode = "json-file" as const;

  constructor(private readonly filePath: string) {}

  async read(): Promise<RuntimeStore> {
    try {
      const payload = JSON.parse(
        readFileSync(this.filePath, "utf8"),
      ) as Partial<StoreShape>;
      return normalizeRuntimeStore(payload);
    } catch {
      return normalizeRuntimeStore({});
    }
  }

  async write(store: RuntimeStore) {
    const payload: StoreShape = {
      projects: [...store.projects.values()],
      shareTokens: Object.fromEntries(store.shareTokens),
      events: store.events,
    };

    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(tempPath, JSON.stringify(payload, null, 2));
    renameSync(tempPath, this.filePath);
  }
}

type PrismaProjectRow = {
  id: string;
  shareToken: string | null;
  stateJson: unknown;
};

type PrismaEventRow = {
  name: string;
  projectId: string | null;
  props: unknown;
  createdAt: Date;
};

type PrismaStoreClient = {
  project: {
    findMany(args: unknown): Promise<PrismaProjectRow[]>;
    upsert(args: unknown): Promise<unknown>;
  };
  eventLog: {
    findMany(args: unknown): Promise<PrismaEventRow[]>;
    deleteMany(args?: unknown): Promise<unknown>;
    createMany(args: unknown): Promise<unknown>;
  };
  $transaction<T>(
    fn: (client: PrismaStoreClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
};

class PrismaProjectStoreAdapter implements ProjectStoreAdapter {
  mode = "prisma" as const;
  private persistedEventKeys = new Set<string>();

  async read(): Promise<RuntimeStore> {
    const client = await getPrismaStoreClient();
    const [projectRows, eventRows] = await Promise.all([
      client.project.findMany({
        select: { id: true, shareToken: true, stateJson: true },
      }),
      client.eventLog.findMany({
        orderBy: { createdAt: "asc" },
        select: { name: true, projectId: true, props: true, createdAt: true },
      }),
    ]);

    this.persistedEventKeys = new Set(
      eventRows.map((row) =>
        createEventPersistenceKey({
          name: row.name as EventName,
          projectId: row.projectId ?? undefined,
          createdAt: row.createdAt.toISOString(),
        }),
      ),
    );

    return normalizeRuntimeStore({
      projects: projectRows.map((row) => row.stateJson).filter(isProjectRecord),
      shareTokens: Object.fromEntries(
        projectRows.flatMap((row) =>
          row.shareToken ? [[row.shareToken, row.id]] : [],
        ),
      ),
      events: eventRows.map((row) => ({
        name: row.name as EventName,
        projectId: row.projectId ?? undefined,
        props: isEventProps(row.props) ? row.props : undefined,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  }

  async write(store: RuntimeStore) {
    const client = await getPrismaStoreClient();
    const projects = [...store.projects.values()];
    const eventsToCreate = store.events.filter(
      (event) => !this.persistedEventKeys.has(createEventPersistenceKey(event)),
    );

    await client.$transaction(
      async (transaction) => {
        for (const project of projects) {
          await transaction.project.upsert({
            where: { id: project.id },
            update: toPrismaProjectUpdate(project),
            create: {
              id: project.id,
              createdAt: new Date(project.createdAt),
              ...toPrismaProjectUpdate(project),
            },
          });
        }

        if (eventsToCreate.length) {
          await transaction.eventLog.createMany({
            data: eventsToCreate.map((event) => ({
              name: event.name,
              projectId:
                event.projectId && store.projects.has(event.projectId)
                  ? event.projectId
                  : null,
              props: event.props ?? {},
              createdAt: new Date(event.createdAt),
            })),
          });
        }
      },
      { maxWait: 10_000, timeout: 15_000 },
    );

    for (const event of eventsToCreate) {
      this.persistedEventKeys.add(createEventPersistenceKey(event));
    }
  }
}

async function getPrismaStoreClient(): Promise<PrismaStoreClient> {
  return (await getPrismaClient()) as unknown as PrismaStoreClient;
}

function toPrismaProjectUpdate(project: ProjectRecord) {
  return {
    title: project.title,
    status: project.status,
    postcode: project.postcode,
    planImageUrl: project.plan.image.url,
    scalePxPerMeter: project.plan.scalePxPerMeter,
    currentPlanId: project.planVersions.at(-1)?.id,
    shareToken: project.shareToken,
    stateJson: project,
  };
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "plan" in value &&
    "variants" in value
  );
}

function isEventProps(value: unknown): value is EventProps {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createEventPersistenceKey(
  event: Pick<TrackedEvent, "name" | "projectId" | "createdAt">,
) {
  return `${event.name}:${event.projectId ?? ""}:${event.createdAt}`;
}

function normalizeRuntimeStore(payload: Partial<StoreShape>): RuntimeStore {
  const projects = new Map<string, ProjectRecord>();
  const shareTokens = new Map<string, string>(
    Object.entries(payload.shareTokens ?? {}),
  );

  for (const project of payload.projects ?? []) {
    projects.set(project.id, normalizeProject(project));

    if (project.shareToken) {
      shareTokens.set(project.shareToken, project.id);
    }
  }

  const store = {
    projects,
    shareTokens,
    events: payload.events ?? [],
  };

  seedDemoProject(store);
  return store;
}

function normalizeProject(project: ProjectRecord): ProjectRecord {
  return {
    ...project,
    uploads: project.uploads ?? [],
    variants: project.variants ?? [],
    planVersions: project.planVersions ?? [
      {
        id: `${project.id}-sample-plan`,
        version: 1,
        source: project.id === "demo-london-flat" ? "SAMPLE" : "MANUAL_EDIT",
        plan: project.plan,
        createdAt: project.createdAt,
      },
    ],
    reportExports: project.reportExports ?? [],
    screenshots: project.screenshots ?? [],
  };
}

function seedDemoProject(store: RuntimeStore) {
  if (store.projects.has("demo-london-flat")) {
    return;
  }

  const createdAt = new Date().toISOString();

  store.projects.set("demo-london-flat", {
    id: "demo-london-flat",
    title: "Sample London flat",
    status: "VARIANTS_GENERATED",
    createdAt,
    updatedAt: createdAt,
    plan: londonFlatPlan,
    uploads: [],
    variants: londonFlatVariants,
    planVersions: [
      {
        id: "demo-london-flat-sample-plan",
        version: 1,
        source: "SAMPLE",
        confidence: 0.96,
        plan: londonFlatPlan,
        createdAt,
      },
    ],
    reportExports: [],
    screenshots: [],
  });
}

export function getProjectStoreMode() {
  return {
    mode: getAdapter().mode,
    filePath: getStoreFilePath(),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  };
}

export async function listEvents(): Promise<TrackedEvent[]> {
  return [...(await getStore()).events];
}

export async function recordEvent(
  name: EventName,
  props?: EventProps,
  projectId?: string,
): Promise<TrackedEvent> {
  const store = await getStore();
  const event = recordEventInStore(store, name, props, projectId);
  await persistStore(store);
  return event;
}

function recordEventInStore(
  store: RuntimeStore,
  name: EventName,
  props?: EventProps,
  projectId?: string,
): TrackedEvent {
  const event = trackEvent(name, props, projectId);
  store.events.push(event);
  return event;
}

export async function getProject(
  projectId: string,
): Promise<ProjectRecord | undefined> {
  return (await getStore()).projects.get(projectId);
}

export async function getProjectOrDemo(
  projectId: string,
): Promise<ProjectRecord> {
  return (
    (await getProject(projectId)) ?? (await getProject("demo-london-flat"))!
  );
}

export async function createProject({
  title,
  postcode,
}: {
  title?: string;
  postcode?: string;
}): Promise<ProjectRecord> {
  const store = await getStore();
  const createdAt = new Date().toISOString();
  const project: ProjectRecord = {
    id: `project-${crypto.randomUUID()}`,
    title: title?.trim() || "Untitled renovation",
    postcode: postcode?.trim() || undefined,
    status: "DRAFT",
    createdAt,
    updatedAt: createdAt,
    plan: londonFlatPlan,
    uploads: [],
    variants: [],
    planVersions: [],
    reportExports: [],
    screenshots: [],
  };

  store.projects.set(project.id, project);
  recordEventInStore(
    store,
    Events.ProjectCreated,
    { hasPostcode: Boolean(project.postcode) },
    project.id,
  );
  await persistStore(store);
  return project;
}

export async function attachUpload(
  projectId: string,
  upload: UploadRecord,
): Promise<ProjectRecord> {
  const store = await getStore();
  const project = await ensureProject(projectId, store);
  const nextPlan = createManualFallbackPlan(upload);

  project.uploads.unshift(upload);
  project.plan = nextPlan;
  project.status = "UPLOADED";
  project.updatedAt = new Date().toISOString();
  project.planVersions.push(
    createPlanVersion(project, nextPlan, "MANUAL_EDIT"),
  );

  recordEventInStore(
    store,
    Events.FloorplanUploaded,
    {
      projectId,
      mimeType: upload.mimeType,
      sizeKb: Math.round(upload.sizeBytes / 1024),
      imageWidth: upload.imageWidth,
      imageHeight: upload.imageHeight,
    },
    project.id,
  );

  if (upload.mimeType === "application/pdf") {
    recordEventInStore(
      store,
      Events.PdfRendered,
      {
        projectId,
        rendered: upload.previewKind === "pdf-rendered",
        fallback: upload.previewKind !== "pdf-rendered",
      },
      project.id,
    );
  }

  await persistStore(store);
  return project;
}

export async function parsePlan(projectId: string): Promise<{
  planProposal: PlanSchema;
  confidence: number;
  warnings: string[];
}> {
  const store = await getStore();
  const project = await ensureProject(projectId, store);
  const isDemo = project.id === "demo-london-flat";

  recordEventInStore(store, Events.PlanParseStarted, { projectId }, project.id);

  const response = isDemo
    ? createDemoParseResponse(project.plan)
    : createUploadedParseResponse(project);

  project.plan = response.planProposal;
  project.status = "PARSED";
  project.updatedAt = new Date().toISOString();
  project.planVersions.push(
    createPlanVersion(
      project,
      response.planProposal,
      "AUTO_PARSE",
      response.confidence,
    ),
  );

  recordEventInStore(
    store,
    Events.PlanParseCompleted,
    {
      projectId,
      wallCount: response.planProposal.walls.length,
      roomCount: response.planProposal.rooms.length,
      confidenceBand: confidenceBand(response.confidence),
      usedFallback: response.confidence < 0.5,
    },
    project.id,
  );

  await persistStore(store);
  return response;
}

export async function savePlan(
  projectId: string,
  plan: PlanSchema,
): Promise<ProjectRecord> {
  const store = await getStore();
  const project = await ensureProject(projectId, store);

  project.plan = plan;
  project.status = "PLAN_CONFIRMED";
  project.updatedAt = new Date().toISOString();
  project.planVersions.push(createPlanVersion(project, plan, "MANUAL_EDIT"));

  recordEventInStore(
    store,
    Events.ScaleConfirmed,
    { projectId, scalePxPerMeter: plan.scalePxPerMeter },
    project.id,
  );
  recordEventInStore(
    store,
    Events.PlanConfirmed,
    {
      projectId,
      wallCount: plan.walls.length,
      roomCount: plan.rooms.length,
      openingCount: plan.openings.length,
    },
    project.id,
  );

  await persistStore(store);
  return project;
}

export async function resetDemoProject(): Promise<ProjectRecord> {
  const store = await getStore();
  const current = store.projects.get("demo-london-flat");
  const now = new Date().toISOString();
  const project: ProjectRecord = {
    id: "demo-london-flat",
    title: "Sample London flat",
    status: "VARIANTS_GENERATED",
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    plan: londonFlatPlan,
    uploads: [],
    variants: londonFlatVariants,
    planVersions: [
      {
        id: "demo-london-flat-sample-plan",
        version: 1,
        source: "SAMPLE",
        confidence: 0.96,
        plan: londonFlatPlan,
        createdAt: now,
      },
    ],
    reportExports: [],
    screenshots: [],
    shareToken: current?.shareToken,
  };

  store.projects.set(project.id, project);

  if (project.shareToken) {
    store.shareTokens.set(project.shareToken, project.id);
  }

  await persistStore(store);
  return project;
}

export async function saveVariant(
  projectId: string,
  variant: DesignVariantSchema,
  props?: Record<string, string | number | boolean | null | undefined>,
): Promise<ProjectRecord> {
  const store = await getStore();
  const project = await ensureProject(projectId, store);

  project.variants = [
    variant,
    ...project.variants.filter((candidate) => candidate.name !== variant.name),
  ];
  project.status = "VARIANTS_GENERATED";
  project.updatedAt = new Date().toISOString();

  recordEventInStore(
    store,
    Events.VariantGenerated,
    { projectId, style: variant.style, ...props },
    project.id,
  );
  await persistStore(store);
  return project;
}

export async function markModelGenerated(
  projectId: string,
): Promise<ProjectRecord> {
  const store = await getStore();
  const project = await ensureProject(projectId, store);
  const shouldMarkGenerated =
    project.status === "PLAN_CONFIRMED" ||
    project.status === "PARSED" ||
    project.status === "UPLOADED";

  if (!shouldMarkGenerated) {
    return project;
  }

  project.status = "MODEL_GENERATED";
  project.updatedAt = new Date().toISOString();

  recordEventInStore(
    store,
    Events.ModelGenerated,
    {
      projectId,
      wallCount: project.plan.walls.length,
      roomCount: project.plan.rooms.length,
    },
    project.id,
  );

  await persistStore(store);
  return project;
}

export async function markWalkthroughStarted(
  projectId: string,
): Promise<ProjectRecord> {
  const store = await getStore();
  const project = await ensureProject(projectId, store);
  recordEventInStore(store, Events.WalkthroughStarted, { projectId }, project.id);
  await persistStore(store);
  return project;
}

export async function markReportExported(
  projectId: string,
): Promise<ProjectRecord> {
  const store = await getStore();
  const project = await ensureProject(projectId, store);
  const latestScreenshot = project.screenshots[0];
  project.reportExports.unshift({
    id: `${project.id}-report-${Date.now()}`,
    screenshotId: latestScreenshot?.id,
    createdAt: new Date().toISOString(),
  });
  recordEventInStore(
    store,
    Events.ReportExported,
    { projectId, variantCount: project.variants.length },
    project.id,
  );
  await persistStore(store);
  return project;
}

export async function saveProjectScreenshot(
  projectId: string,
  screenshot: Omit<ProjectScreenshotRecord, "id" | "createdAt">,
): Promise<ProjectScreenshotRecord> {
  const store = await getStore();
  const project = await ensureProject(projectId, store);
  const record: ProjectScreenshotRecord = {
    ...screenshot,
    id: `${project.id}-screenshot-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  project.screenshots = [record, ...project.screenshots].slice(0, 6);
  project.updatedAt = record.createdAt;
  await persistStore(store);
  return record;
}

export async function createShare(projectId: string): Promise<{
  project: ProjectRecord;
  shareToken: string;
}> {
  const store = await getStore();
  const project = await ensureProject(projectId, store);

  if (!project.shareToken) {
    project.shareToken = crypto.randomUUID().replaceAll("-", "");
    store.shareTokens.set(project.shareToken, project.id);
  }

  project.status = "SHARED";
  project.updatedAt = new Date().toISOString();

  recordEventInStore(store, Events.ShareCreated, { projectId }, project.id);
  await persistStore(store);
  return { project, shareToken: project.shareToken };
}

export async function getProjectByShareToken(
  token: string,
): Promise<ProjectRecord | undefined> {
  const store = await getStore();
  const projectId = store.shareTokens.get(token);

  if (!projectId) {
    return undefined;
  }

  return store.projects.get(projectId);
}

async function ensureProject(
  projectId: string,
  store?: RuntimeStore,
): Promise<ProjectRecord> {
  const targetStore = store ?? (await getStore());
  const project = targetStore.projects.get(projectId);

  if (project) {
    return project;
  }

  const createdAt = new Date().toISOString();
  const fallback: ProjectRecord = {
    id: projectId,
    title: "Untitled renovation",
    status: "DRAFT",
    createdAt,
    updatedAt: createdAt,
    plan: londonFlatPlan,
    uploads: [],
    variants: [],
    planVersions: [],
    reportExports: [],
    screenshots: [],
  };

  targetStore.projects.set(projectId, fallback);
  return fallback;
}

function createManualFallbackPlan(upload: UploadRecord): PlanSchema {
  return {
    units: "m",
    scalePxPerMeter: 70,
    image: {
      widthPx: upload.imageWidth,
      heightPx: upload.imageHeight,
      url: upload.planImageUrl,
    },
    walls: [],
    openings: [],
    rooms: [],
  };
}

function createPlanVersion(
  project: ProjectRecord,
  plan: PlanSchema,
  source: PlanVersionRecord["source"],
  confidence?: number,
): PlanVersionRecord {
  return {
    id: `${project.id}-plan-${project.planVersions.length + 1}-${Date.now()}`,
    version: project.planVersions.length + 1,
    source,
    confidence,
    plan,
    createdAt: new Date().toISOString(),
  };
}

function createDemoParseResponse(plan: PlanSchema) {
  return {
    planProposal: plan,
    confidence: 0.96,
    warnings: ["Sample fixture uses pre-validated wall geometry."],
  };
}

function createUploadedParseResponse(project: ProjectRecord) {
  const latestUpload = project.uploads[0];
  const parsedWalls = latestUpload
    ? parseUploadedSvgWalls(
        latestUpload.planImageUrl,
        project.plan.image.widthPx,
        project.plan.image.heightPx,
      )
    : [];
  const usedSvgProposal = parsedWalls.length >= 4;
  const walls = usedSvgProposal
    ? parsedWalls
    : createBoundingWallProposal(project.plan);
  const rooms =
    project.plan.rooms.length > 0
      ? project.plan.rooms
      : createBoundingRoomProposal(project.plan);
  const confidence = usedSvgProposal
    ? Math.min(0.78, 0.52 + Math.min(parsedWalls.length, 18) * 0.012)
    : 0.3;
  const warnings = usedSvgProposal
    ? [
        `Parser found ${parsedWalls.length} normalized SVG wall candidates. Review scale, rooms, and openings before generating 3D.`,
      ]
    : [
        "Parser used a low-confidence bounding-room proposal. Manual trace remains available and is recommended.",
        "Uploaded raster/PDF plans are not CAD-interpreted; the proposal is only a starting point.",
      ];

  return {
    planProposal: {
      ...project.plan,
      walls,
      openings: project.plan.openings.filter((opening) =>
        walls.some((wall) => wall.id === opening.wallId),
      ),
      rooms,
    },
    confidence,
    warnings,
  };
}

function createBoundingWallProposal(plan: PlanSchema): Wall[] {
  const marginX = Math.max(36, Math.round(plan.image.widthPx * 0.08));
  const marginY = Math.max(36, Math.round(plan.image.heightPx * 0.08));
  const left = marginX;
  const right = plan.image.widthPx - marginX;
  const top = marginY;
  const bottom = plan.image.heightPx - marginY;

  return [
    createWall("proposal-n", left, top, right, top),
    createWall("proposal-e", right, top, right, bottom),
    createWall("proposal-s", right, bottom, left, bottom),
    createWall("proposal-w", left, bottom, left, top),
  ];
}

function createBoundingRoomProposal(plan: PlanSchema): PlanSchema["rooms"] {
  const marginX = Math.max(36, Math.round(plan.image.widthPx * 0.08));
  const marginY = Math.max(36, Math.round(plan.image.heightPx * 0.08));
  const left = marginX;
  const right = plan.image.widthPx - marginX;
  const top = marginY;
  const bottom = plan.image.heightPx - marginY;
  const areaM2 = Number(
    (
      ((right - left) / plan.scalePxPerMeter) *
      ((bottom - top) / plan.scalePxPerMeter)
    ).toFixed(1),
  );

  return [
    {
      id: "proposal-room",
      label: "Trace proposal",
      polygon: [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
      ],
      areaM2,
    },
  ];
}

function parseUploadedSvgWalls(
  planImageUrl: string,
  widthPx: number,
  heightPx: number,
): Wall[] {
  const svg = decodeSvgDataUrl(planImageUrl);
  if (!svg) {
    return [];
  }

  const walls: Wall[] = [];
  const linePattern = /<line\b([^>]*)>/gi;
  let lineMatch: RegExpExecArray | null;
  while ((lineMatch = linePattern.exec(svg))) {
    const attrs = readSvgNumberAttributes(lineMatch[1] ?? "");
    const x1 = attrs.get("x1");
    const y1 = attrs.get("y1");
    const x2 = attrs.get("x2");
    const y2 = attrs.get("y2");

    if (
      x1 !== undefined &&
      y1 !== undefined &&
      x2 !== undefined &&
      y2 !== undefined
    ) {
      walls.push(
        createWall(`proposal-line-${walls.length + 1}`, x1, y1, x2, y2),
      );
    }
  }

  const rectPattern = /<rect\b([^>]*)>/gi;
  let rectMatch: RegExpExecArray | null;
  while ((rectMatch = rectPattern.exec(svg))) {
    const attrs = readSvgNumberAttributes(rectMatch[1] ?? "");
    const x = attrs.get("x") ?? 0;
    const y = attrs.get("y") ?? 0;
    const width = attrs.get("width");
    const height = attrs.get("height");

    if (width !== undefined && height !== undefined) {
      walls.push(...createRectWalls(x, y, width, height, walls.length));
    }
  }

  const pointsPattern = /<(?:polyline|polygon)\b([^>]*)>/gi;
  let pointsMatch: RegExpExecArray | null;
  while ((pointsMatch = pointsPattern.exec(svg))) {
    const [, rawPoints = ""] =
      pointsMatch[1]?.match(/\bpoints\s*=\s*["']([^"']+)["']/i) ?? [];
    const closeShape = /^<polygon/i.test(pointsMatch[0] ?? "");
    walls.push(
      ...parseSvgPoints(
        rawPoints,
        closeShape,
        `proposal-points-${walls.length}`,
      ),
    );
  }

  const pathPattern = /<path\b[^>]*\sd=["']([^"']+)["'][^>]*>/gi;
  let pathMatch: RegExpExecArray | null;
  while ((pathMatch = pathPattern.exec(svg))) {
    walls.push(...parseRectilinearPath(pathMatch[1] ?? "", walls.length));
  }

  return normalizeWallCandidates(walls, widthPx, heightPx).slice(0, 32);
}

function readSvgNumberAttributes(markup: string): Map<string, number> {
  const attrs = new Map<string, number>();
  const attrPattern = /\b([a-zA-Z][\w:-]*)\s*=\s*["']?(-?\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(markup))) {
    attrs.set(match[1]!.toLowerCase(), Number(match[2]));
  }

  return attrs;
}

function decodeSvgDataUrl(dataUrl: string): string | null {
  if (!dataUrl.startsWith("data:image/svg+xml")) {
    return null;
  }

  const [, payload = ""] = dataUrl.split(",", 2);
  if (!payload) {
    return null;
  }

  try {
    if (dataUrl.includes(";base64,")) {
      return Buffer.from(payload, "base64").toString("utf8");
    }

    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function parseRectilinearPath(pathData: string, offset: number): Wall[] {
  const tokens =
    pathData.match(/[MLHVZmlhvz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const walls: Wall[] = [];
  let cursor = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let command = "";

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (/^[MLHVZmlhvz]$/.test(token)) {
      command = token;

      if (command.toUpperCase() === "Z") {
        walls.push(
          createWall(
            `proposal-path-${offset + walls.length + 1}`,
            cursor.x,
            cursor.y,
            start.x,
            start.y,
          ),
        );
        cursor = { ...start };
      }

      continue;
    }

    if (command.toUpperCase() === "M" || command.toUpperCase() === "L") {
      const x = Number(token);
      const y = Number(tokens[index + 1]);
      index += 1;
      const next =
        command === command.toLowerCase()
          ? { x: cursor.x + x, y: cursor.y + y }
          : { x, y };
      if (command.toUpperCase() === "M") {
        start = next;
      } else {
        walls.push(
          createWall(
            `proposal-path-${offset + walls.length + 1}`,
            cursor.x,
            cursor.y,
            next.x,
            next.y,
          ),
        );
      }
      cursor = next;
    } else if (command.toUpperCase() === "H") {
      const x = Number(token);
      const next = {
        x: command === command.toLowerCase() ? cursor.x + x : x,
        y: cursor.y,
      };
      walls.push(
        createWall(
          `proposal-path-${offset + walls.length + 1}`,
          cursor.x,
          cursor.y,
          next.x,
          next.y,
        ),
      );
      cursor = next;
    } else if (command.toUpperCase() === "V") {
      const y = Number(token);
      const next = {
        x: cursor.x,
        y: command === command.toLowerCase() ? cursor.y + y : y,
      };
      walls.push(
        createWall(
          `proposal-path-${offset + walls.length + 1}`,
          cursor.x,
          cursor.y,
          next.x,
          next.y,
        ),
      );
      cursor = next;
    }
  }

  return walls.filter(
    (wall) =>
      Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) >= 16,
  );
}

function createRectWalls(
  x: number,
  y: number,
  width: number,
  height: number,
  offset: number,
): Wall[] {
  if (width <= 0 || height <= 0) {
    return [];
  }

  return [
    createWall(`proposal-rect-${offset + 1}`, x, y, x + width, y),
    createWall(
      `proposal-rect-${offset + 2}`,
      x + width,
      y,
      x + width,
      y + height,
    ),
    createWall(
      `proposal-rect-${offset + 3}`,
      x + width,
      y + height,
      x,
      y + height,
    ),
    createWall(`proposal-rect-${offset + 4}`, x, y + height, x, y),
  ];
}

function parseSvgPoints(
  rawPoints: string,
  closeShape: boolean,
  idPrefix: string,
): Wall[] {
  const values =
    rawPoints.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
  const points: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < values.length - 1; index += 2) {
    points.push({ x: values[index]!, y: values[index + 1]! });
  }

  const walls: Wall[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    walls.push(
      createWall(
        `${idPrefix}-${index + 1}`,
        points[index]!.x,
        points[index]!.y,
        points[index + 1]!.x,
        points[index + 1]!.y,
      ),
    );
  }

  if (closeShape && points.length > 2) {
    const first = points[0]!;
    const last = points.at(-1)!;
    walls.push(
      createWall(
        `${idPrefix}-${points.length}`,
        last.x,
        last.y,
        first.x,
        first.y,
      ),
    );
  }

  return walls;
}

function createWall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Wall {
  return {
    id,
    start: { x: Math.round(x1), y: Math.round(y1) },
    end: { x: Math.round(x2), y: Math.round(y2) },
    thicknessM: 0.14,
    heightM: 2.6,
  };
}

function normalizeWallCandidates(
  walls: Wall[],
  widthPx: number,
  heightPx: number,
): Wall[] {
  const snapped = walls
    .map((wall) => snapWallToUsefulLine(wall, widthPx, heightPx))
    .filter((wall): wall is Wall => Boolean(wall));
  const horizontal = mergeAxisAlignedWalls(
    snapped.filter((wall) => wall.start.y === wall.end.y),
    "horizontal",
  );
  const vertical = mergeAxisAlignedWalls(
    snapped.filter((wall) => wall.start.x === wall.end.x),
    "vertical",
  );
  const diagonal = dedupeWalls(
    snapped.filter(
      (wall) => wall.start.x !== wall.end.x && wall.start.y !== wall.end.y,
    ),
  );

  return dedupeWalls([...horizontal, ...vertical, ...diagonal])
    .sort((first, second) => wallLength(second) - wallLength(first))
    .map((wall, index) => ({ ...wall, id: `proposal-wall-${index + 1}` }));
}

function snapWallToUsefulLine(
  wall: Wall,
  widthPx: number,
  heightPx: number,
): Wall | null {
  const length = wallLength(wall);
  if (!Number.isFinite(length) || length < 24) {
    return null;
  }

  const start = {
    x: clamp(Math.round(wall.start.x), 0, widthPx),
    y: clamp(Math.round(wall.start.y), 0, heightPx),
  };
  const end = {
    x: clamp(Math.round(wall.end.x), 0, widthPx),
    y: clamp(Math.round(wall.end.y), 0, heightPx),
  };
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const axisTolerance = Math.max(6, Math.round(length * 0.045));

  if (dy <= axisTolerance) {
    const y = Math.round((start.y + end.y) / 2);
    return createWall(
      wall.id,
      Math.min(start.x, end.x),
      y,
      Math.max(start.x, end.x),
      y,
    );
  }

  if (dx <= axisTolerance) {
    const x = Math.round((start.x + end.x) / 2);
    return createWall(
      wall.id,
      x,
      Math.min(start.y, end.y),
      x,
      Math.max(start.y, end.y),
    );
  }

  if (length < 80) {
    return null;
  }

  return createWall(wall.id, start.x, start.y, end.x, end.y);
}

function mergeAxisAlignedWalls(
  walls: Wall[],
  axis: "horizontal" | "vertical",
): Wall[] {
  const groups = new Map<number, Array<[number, number]>>();
  const laneTolerance = 7;
  const gapTolerance = 14;

  for (const wall of walls) {
    const lane = axis === "horizontal" ? wall.start.y : wall.start.x;
    const from =
      axis === "horizontal"
        ? Math.min(wall.start.x, wall.end.x)
        : Math.min(wall.start.y, wall.end.y);
    const to =
      axis === "horizontal"
        ? Math.max(wall.start.x, wall.end.x)
        : Math.max(wall.start.y, wall.end.y);
    const existingLane = [...groups.keys()].find(
      (candidate) => Math.abs(candidate - lane) <= laneTolerance,
    );
    const groupLane = existingLane ?? lane;
    groups.set(groupLane, [...(groups.get(groupLane) ?? []), [from, to]]);
  }

  const merged: Wall[] = [];
  for (const [lane, ranges] of groups) {
    const sorted = ranges.sort((first, second) => first[0] - second[0]);
    const collapsed: Array<[number, number]> = [];

    for (const range of sorted) {
      const last = collapsed.at(-1);
      if (last && range[0] <= last[1] + gapTolerance) {
        last[1] = Math.max(last[1], range[1]);
      } else {
        collapsed.push([...range]);
      }
    }

    for (const [from, to] of collapsed) {
      if (to - from >= 24) {
        merged.push(
          axis === "horizontal"
            ? createWall(`merged-h-${merged.length + 1}`, from, lane, to, lane)
            : createWall(`merged-v-${merged.length + 1}`, lane, from, lane, to),
        );
      }
    }
  }

  return merged;
}

function dedupeWalls(walls: Wall[]): Wall[] {
  const unique = new Map<string, Wall>();

  for (const wall of walls) {
    const key = [
      Math.round(wall.start.x / 3),
      Math.round(wall.start.y / 3),
      Math.round(wall.end.x / 3),
      Math.round(wall.end.y / 3),
    ].join(":");
    unique.set(key, wall);
  }

  return [...unique.values()];
}

function wallLength(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function confidenceBand(confidence: number) {
  if (confidence >= 0.8) {
    return "high";
  }
  if (confidence >= 0.5) {
    return "medium";
  }
  return "low";
}
