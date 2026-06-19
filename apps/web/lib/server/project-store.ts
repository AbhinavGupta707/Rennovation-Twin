import { londonFlatPlan, londonFlatVariants } from "@renovation-twin/fixtures";
import {
  Events,
  getLocalEvents,
  trackEvent,
  type TrackedEvent,
} from "@renovation-twin/events";
import type { DesignVariantSchema, PlanSchema } from "@renovation-twin/types";

export type UploadRecord = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  planImageUrl: string;
  imageWidth: number;
  imageHeight: number;
  createdAt: string;
};

export type ProjectRecord = {
  id: string;
  title: string;
  status:
    | "DRAFT"
    | "UPLOADED"
    | "PARSED"
    | "PLAN_CONFIRMED"
    | "MODEL_GENERATED"
    | "VARIANTS_GENERATED"
    | "SHARED";
  createdAt: string;
  updatedAt: string;
  postcode?: string;
  plan: PlanSchema;
  uploads: UploadRecord[];
  variants: DesignVariantSchema[];
  shareToken?: string;
};

type Store = {
  projects: Map<string, ProjectRecord>;
  shareTokens: Map<string, string>;
};

const globalStore = globalThis as unknown as {
  renovationTwinStore?: Store;
};

function getStore(): Store {
  if (!globalStore.renovationTwinStore) {
    globalStore.renovationTwinStore = {
      projects: new Map(),
      shareTokens: new Map(),
    };
  }

  seedDemoProject(globalStore.renovationTwinStore);
  return globalStore.renovationTwinStore;
}

function seedDemoProject(store: Store) {
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
  });
}

export function listEvents(): TrackedEvent[] {
  return getLocalEvents();
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
  };

  store.projects.set(project.id, project);
  trackEvent(
    Events.ProjectCreated,
    { hasPostcode: Boolean(project.postcode) },
    project.id,
  );
  return project;
}

export function attachUpload(
  projectId: string,
  upload: UploadRecord,
): ProjectRecord {
  const project = ensureProject(projectId);
  const nextPlan = createManualFallbackPlan(upload);

  project.uploads.unshift(upload);
  project.plan = nextPlan;
  project.status = "UPLOADED";
  project.updatedAt = new Date().toISOString();

  trackEvent(
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

  return project;
}

export function parsePlan(projectId: string): {
  planProposal: PlanSchema;
  confidence: number;
  warnings: string[];
} {
  const project = ensureProject(projectId);
  const isDemo = project.id === "demo-london-flat";

  trackEvent(Events.PlanParseStarted, { projectId }, project.id);

  const response = {
    planProposal: project.plan,
    confidence: isDemo ? 0.96 : 0.12,
    warnings: isDemo
      ? ["Sample fixture uses pre-validated wall geometry."]
      : [
          "Automatic parsing is in fallback mode. Use manual trace to confirm walls, openings, and scale.",
        ],
  };

  project.status = "PARSED";
  project.updatedAt = new Date().toISOString();

  trackEvent(
    Events.PlanParseCompleted,
    {
      projectId,
      wallCount: response.planProposal.walls.length,
      roomCount: response.planProposal.rooms.length,
      confidenceBand: isDemo ? "high" : "low",
      usedFallback: !isDemo,
    },
    project.id,
  );

  return response;
}

export function savePlan(projectId: string, plan: PlanSchema): ProjectRecord {
  const project = ensureProject(projectId);

  project.plan = plan;
  project.status = "PLAN_CONFIRMED";
  project.updatedAt = new Date().toISOString();

  trackEvent(
    Events.ScaleConfirmed,
    { projectId, scalePxPerMeter: plan.scalePxPerMeter },
    project.id,
  );
  trackEvent(
    Events.PlanConfirmed,
    {
      projectId,
      wallCount: plan.walls.length,
      roomCount: plan.rooms.length,
      openingCount: plan.openings.length,
    },
    project.id,
  );

  return project;
}

export function saveVariant(
  projectId: string,
  variant: DesignVariantSchema,
  props?: Record<string, string | number | boolean | null | undefined>,
): ProjectRecord {
  const project = ensureProject(projectId);

  project.variants = [
    variant,
    ...project.variants.filter((candidate) => candidate.name !== variant.name),
  ];
  project.status = "VARIANTS_GENERATED";
  project.updatedAt = new Date().toISOString();

  trackEvent(
    Events.VariantGenerated,
    { projectId, style: variant.style, ...props },
    project.id,
  );
  return project;
}

export function markModelGenerated(projectId: string): ProjectRecord {
  const project = ensureProject(projectId);

  if (
    project.status === "PLAN_CONFIRMED" ||
    project.status === "PARSED" ||
    project.status === "UPLOADED"
  ) {
    project.status = "MODEL_GENERATED";
    project.updatedAt = new Date().toISOString();
  }

  trackEvent(
    Events.ModelGenerated,
    {
      projectId,
      wallCount: project.plan.walls.length,
      roomCount: project.plan.rooms.length,
    },
    project.id,
  );

  return project;
}

export function markWalkthroughStarted(projectId: string): ProjectRecord {
  const project = ensureProject(projectId);
  trackEvent(Events.WalkthroughStarted, { projectId }, project.id);
  return project;
}

export function markReportExported(projectId: string): ProjectRecord {
  const project = ensureProject(projectId);
  trackEvent(
    Events.ReportExported,
    { projectId, variantCount: project.variants.length },
    project.id,
  );
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

  trackEvent(Events.ShareCreated, { projectId }, project.id);
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
  };

  getStore().projects.set(projectId, fallback);
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
