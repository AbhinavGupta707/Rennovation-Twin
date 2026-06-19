import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
  mode: "json-file";
  read(): RuntimeStore;
  write(store: RuntimeStore): void;
};

const globalStore = globalThis as unknown as {
  renovationTwinStore?: RuntimeStore;
  renovationTwinStoreAdapter?: ProjectStoreAdapter;
};

function getStore(): RuntimeStore {
  if (!globalStore.renovationTwinStore) {
    globalStore.renovationTwinStore = getAdapter().read();
  }

  seedDemoProject(globalStore.renovationTwinStore);
  return globalStore.renovationTwinStore;
}

function getAdapter(): ProjectStoreAdapter {
  if (!globalStore.renovationTwinStoreAdapter) {
    globalStore.renovationTwinStoreAdapter = new JsonFileProjectStoreAdapter(
      getStoreFilePath(),
    );
  }

  return globalStore.renovationTwinStoreAdapter;
}

function getStoreFilePath() {
  return (
    process.env.RENOVATION_TWIN_STORE_PATH ??
    join(process.cwd(), ".renovation-twin-store", "project-store.json")
  );
}

function persistStore(store = getStore()) {
  getAdapter().write(store);
}

class JsonFileProjectStoreAdapter implements ProjectStoreAdapter {
  mode = "json-file" as const;

  constructor(private readonly filePath: string) {}

  read(): RuntimeStore {
    try {
      const payload = JSON.parse(
        readFileSync(this.filePath, "utf8"),
      ) as Partial<StoreShape>;
      return normalizeRuntimeStore(payload);
    } catch {
      return normalizeRuntimeStore({});
    }
  }

  write(store: RuntimeStore) {
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
  });
}

export function getProjectStoreMode() {
  return {
    mode: getAdapter().mode,
    filePath: getStoreFilePath(),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  };
}

export function listEvents(): TrackedEvent[] {
  return [...getStore().events];
}

export function recordEvent(
  name: EventName,
  props?: EventProps,
  projectId?: string,
): TrackedEvent {
  const store = getStore();
  const event = trackEvent(name, props, projectId);
  store.events.push(event);
  persistStore(store);
  return event;
}

export function getProject(projectId: string): ProjectRecord | undefined {
  return getStore().projects.get(projectId);
}

export function getProjectOrDemo(projectId: string): ProjectRecord {
  return getProject(projectId) ?? getProject("demo-london-flat")!;
}

export function createProject({
  title,
  postcode,
}: {
  title?: string;
  postcode?: string;
}): ProjectRecord {
  const store = getStore();
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
  };

  store.projects.set(project.id, project);
  recordEvent(
    Events.ProjectCreated,
    { hasPostcode: Boolean(project.postcode) },
    project.id,
  );
  persistStore(store);
  return project;
}

export function attachUpload(
  projectId: string,
  upload: UploadRecord,
): ProjectRecord {
  const store = getStore();
  const project = ensureProject(projectId);
  const nextPlan = createManualFallbackPlan(upload);

  project.uploads.unshift(upload);
  project.plan = nextPlan;
  project.status = "UPLOADED";
  project.updatedAt = new Date().toISOString();
  project.planVersions.push(
    createPlanVersion(project, nextPlan, "MANUAL_EDIT"),
  );

  recordEvent(
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
    recordEvent(
      Events.PdfRendered,
      { projectId, rendered: false, fallback: true },
      project.id,
    );
  }

  persistStore(store);
  return project;
}

export function parsePlan(projectId: string): {
  planProposal: PlanSchema;
  confidence: number;
  warnings: string[];
} {
  const store = getStore();
  const project = ensureProject(projectId);
  const isDemo = project.id === "demo-london-flat";

  recordEvent(Events.PlanParseStarted, { projectId }, project.id);

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

  recordEvent(
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

  persistStore(store);
  return response;
}

export function savePlan(projectId: string, plan: PlanSchema): ProjectRecord {
  const store = getStore();
  const project = ensureProject(projectId);

  project.plan = plan;
  project.status = "PLAN_CONFIRMED";
  project.updatedAt = new Date().toISOString();
  project.planVersions.push(createPlanVersion(project, plan, "MANUAL_EDIT"));

  recordEvent(
    Events.ScaleConfirmed,
    { projectId, scalePxPerMeter: plan.scalePxPerMeter },
    project.id,
  );
  recordEvent(
    Events.PlanConfirmed,
    {
      projectId,
      wallCount: plan.walls.length,
      roomCount: plan.rooms.length,
      openingCount: plan.openings.length,
    },
    project.id,
  );

  persistStore(store);
  return project;
}

export function saveVariant(
  projectId: string,
  variant: DesignVariantSchema,
  props?: Record<string, string | number | boolean | null | undefined>,
): ProjectRecord {
  const store = getStore();
  const project = ensureProject(projectId);

  project.variants = [
    variant,
    ...project.variants.filter((candidate) => candidate.name !== variant.name),
  ];
  project.status = "VARIANTS_GENERATED";
  project.updatedAt = new Date().toISOString();

  recordEvent(
    Events.VariantGenerated,
    { projectId, style: variant.style, ...props },
    project.id,
  );
  persistStore(store);
  return project;
}

export function markModelGenerated(projectId: string): ProjectRecord {
  const store = getStore();
  const project = ensureProject(projectId);

  if (
    project.status === "PLAN_CONFIRMED" ||
    project.status === "PARSED" ||
    project.status === "UPLOADED"
  ) {
    project.status = "MODEL_GENERATED";
    project.updatedAt = new Date().toISOString();
  }

  recordEvent(
    Events.ModelGenerated,
    {
      projectId,
      wallCount: project.plan.walls.length,
      roomCount: project.plan.rooms.length,
    },
    project.id,
  );

  persistStore(store);
  return project;
}

export function markWalkthroughStarted(projectId: string): ProjectRecord {
  const project = ensureProject(projectId);
  recordEvent(Events.WalkthroughStarted, { projectId }, project.id);
  return project;
}

export function markReportExported(projectId: string): ProjectRecord {
  const store = getStore();
  const project = ensureProject(projectId);
  project.reportExports.unshift({
    id: `${project.id}-report-${Date.now()}`,
    createdAt: new Date().toISOString(),
  });
  recordEvent(
    Events.ReportExported,
    { projectId, variantCount: project.variants.length },
    project.id,
  );
  persistStore(store);
  return project;
}

export function createShare(projectId: string): {
  project: ProjectRecord;
  shareToken: string;
} {
  const store = getStore();
  const project = ensureProject(projectId);

  if (!project.shareToken) {
    project.shareToken = crypto.randomUUID().replaceAll("-", "");
    store.shareTokens.set(project.shareToken, project.id);
  }

  project.status = "SHARED";
  project.updatedAt = new Date().toISOString();

  recordEvent(Events.ShareCreated, { projectId }, project.id);
  persistStore(store);
  return { project, shareToken: project.shareToken };
}

export function getProjectByShareToken(
  token: string,
): ProjectRecord | undefined {
  const store = getStore();
  const projectId = store.shareTokens.get(token);

  if (!projectId) {
    return undefined;
  }

  return store.projects.get(projectId);
}

function ensureProject(projectId: string): ProjectRecord {
  const store = getStore();
  const project = getProject(projectId);

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
  };

  store.projects.set(projectId, fallback);
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
    ? parseUploadedSvgWalls(latestUpload.planImageUrl)
    : [];
  const walls =
    parsedWalls.length >= 4
      ? parsedWalls
      : createBoundingWallProposal(project.plan);
  const confidence = parsedWalls.length >= 4 ? 0.62 : 0.28;
  const warnings =
    parsedWalls.length >= 4
      ? [
          "Parser found simple wall-like SVG lines. Review scale, rooms, and openings before generating 3D.",
        ]
      : [
          "Parser used a low-confidence bounding-room proposal. Manual trace remains available.",
        ];

  return {
    planProposal: {
      ...project.plan,
      walls,
      openings: project.plan.openings.filter((opening) =>
        walls.some((wall) => wall.id === opening.wallId),
      ),
      rooms: project.plan.rooms,
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

function parseUploadedSvgWalls(planImageUrl: string): Wall[] {
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
      walls.push(createWall(`proposal-line-${walls.length + 1}`, x1, y1, x2, y2));
    }
  }

  const pathPattern = /<path\b[^>]*\sd=["']([^"']+)["'][^>]*>/gi;
  let pathMatch: RegExpExecArray | null;
  while ((pathMatch = pathPattern.exec(svg))) {
    walls.push(...parseRectilinearPath(pathMatch[1] ?? "", walls.length));
  }

  return mergeCollinearWalls(walls).slice(0, 24);
}

function readSvgNumberAttributes(markup: string): Map<string, number> {
  const attrs = new Map<string, number>();
  const attrPattern =
    /\b([a-zA-Z][\w:-]*)\s*=\s*["']?(-?\d+(?:\.\d+)?)/g;
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
  const tokens = pathData.match(/[MLHVZmlhvz]|-?\d+(?:\.\d+)?/g) ?? [];
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

function mergeCollinearWalls(walls: Wall[]): Wall[] {
  const unique = new Map<string, Wall>();

  for (const wall of walls) {
    const dx = Math.abs(wall.end.x - wall.start.x);
    const dy = Math.abs(wall.end.y - wall.start.y);
    const normalized =
      dx >= dy
        ? {
            ...wall,
            start: {
              x: Math.min(wall.start.x, wall.end.x),
              y: Math.round((wall.start.y + wall.end.y) / 2),
            },
            end: {
              x: Math.max(wall.start.x, wall.end.x),
              y: Math.round((wall.start.y + wall.end.y) / 2),
            },
          }
        : {
            ...wall,
            start: {
              x: Math.round((wall.start.x + wall.end.x) / 2),
              y: Math.min(wall.start.y, wall.end.y),
            },
            end: {
              x: Math.round((wall.start.x + wall.end.x) / 2),
              y: Math.max(wall.start.y, wall.end.y),
            },
          };
    const key = `${normalized.start.x}:${normalized.start.y}:${normalized.end.x}:${normalized.end.y}`;
    unique.set(key, normalized);
  }

  return [...unique.values()];
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
