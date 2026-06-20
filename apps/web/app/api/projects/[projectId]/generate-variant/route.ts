import {
  DesignVariantSchemaZ,
  type DesignVariantSchema,
} from "@renovation-twin/types";
import { Events } from "@renovation-twin/events";
import { pendoTrackServer } from "../../../../../lib/server/pendo-track";
import {
  createFallbackVariantForPlan,
  runJsonModel,
  sanitizeVariantForPlan,
} from "@renovation-twin/ai";
import {
  getProjectOrDemo,
  recordEvent,
  saveVariant,
} from "../../../../../lib/server/project-store";
import { jsonOk } from "../../../../../lib/server/api-response";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    stylePreset?: string;
    budgetLevel?: string;
    useIntent?: string;
    householdType?: string;
    roomPriorities?: unknown;
    palette?: unknown;
  };
  const project = await getProjectOrDemo(projectId);
  const prompt =
    body.prompt?.trim() || "Create a polished, practical renovation concept.";
  const stylePreset = body.stylePreset?.trim() || "Warm Minimal";
  const paletteOverride = normalizePalette(body.palette);
  const validRoomIds = new Set(project.plan.rooms.map((room) => room.id));
  const intent = {
    budgetLevel: normalizeBudgetLevel(body.budgetLevel),
    useIntent: body.useIntent?.trim() || "flexible living",
    householdType: body.householdType?.trim() || "mixed household",
    roomPriorities: normalizeRoomPriorities(body.roomPriorities).filter(
      (roomId) => validRoomIds.has(roomId),
    ),
  };

  await recordEvent(
    Events.VariantPromptSubmitted,
    {
      projectId,
      stylePreset,
      promptLength: prompt.length,
      budgetLevel: intent.budgetLevel,
      useIntent: intent.useIntent,
      householdType: intent.householdType,
      roomPriorityCount: intent.roomPriorities.length,
      customPalette: Boolean(paletteOverride),
    },
    project.id,
  );
  pendoTrackServer(Events.VariantPromptSubmitted, {
    projectId,
    stylePreset,
    promptLength: prompt.length,
    budgetLevel: intent.budgetLevel,
    useIntent: intent.useIntent,
    householdType: intent.householdType,
    roomPriorityCount: intent.roomPriorities.length,
  }, project.id);

  let variant;
  let provider: "fireworks" | "fallback" = "fireworks";
  let warning: string | undefined;

  try {
    variant = await runJsonModel({
      schema: DesignVariantSchemaZ,
      schemaName: "DesignVariantSchema",
      jsonSchema: createDesignVariantJsonSchema(
        project.plan.rooms.map((room) => room.id),
      ),
      maxTokens: 1200,
      timeoutMs: 10_000,
      system:
        "You create practical interior design variants from structured floor-plan JSON. Return compact JSON that exactly matches the provided schema. Use the given room ids only. Use valid hex colors. Never claim structural feasibility.",
      user: JSON.stringify({
        plan: {
          units: project.plan.units,
          scalePxPerMeter: project.plan.scalePxPerMeter,
          wallCount: project.plan.walls.length,
          openingCount: project.plan.openings.length,
          rooms: project.plan.rooms.map((room) => ({
            id: room.id,
            label: room.label,
            areaM2: room.areaM2,
            floorMaterial: room.floorMaterial,
          })),
        },
        prompt,
        stylePreset,
        intent,
        preferredPalette: paletteOverride,
        requiredOutput:
          "Return one top-level DesignVariantSchema object. Do not wrap it in variant/data/result. Use palette.wall, palette.floor, palette.accent, and palette.textile as #RRGGBB hex colors. Keep summaries short.",
      }),
    });
    variant = applyPaletteOverride(
      {
        ...sanitizeVariantForPlan(variant, project.plan, intent),
        name: stylePreset,
      },
      paletteOverride,
    );
  } catch (error) {
    provider = "fallback";
    warning =
      error instanceof Error ? error.message : "Fireworks generation failed.";
    variant = createFallbackVariantForPlan(
      project.plan,
      {
        prompt,
        stylePreset,
        intent,
      },
      project.variants.length,
    );
    variant = applyPaletteOverride(variant, paletteOverride);
  }

  await saveVariant(project.id, variant, {
    provider,
    usedFallback: provider === "fallback",
    budgetLevel: intent.budgetLevel,
    useIntent: intent.useIntent,
    householdType: intent.householdType,
    roomPriorityCount: intent.roomPriorities.length,
    customPalette: Boolean(paletteOverride),
  });

  return jsonOk({
    variantId: `${project.id}-${variant.name.toLowerCase().replaceAll(" ", "-")}`,
    variant,
    provider,
    warning,
  });
}

function normalizeBudgetLevel(value: unknown): "lean" | "balanced" | "premium" {
  return value === "lean" || value === "premium" || value === "balanced"
    ? value
    : "balanced";
}

function normalizeRoomPriorities(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizePalette(
  value: unknown,
): DesignVariantSchema["palette"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<Record<keyof DesignVariantSchema["palette"], unknown>>;
  const wall = normalizeHexColor(candidate.wall);
  const floor = normalizeHexColor(candidate.floor);
  const accent = normalizeHexColor(candidate.accent);
  const textile = normalizeHexColor(candidate.textile);

  if (!wall || !floor || !accent || !textile) {
    return undefined;
  }

  return { wall, floor, accent, textile };
}

function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : undefined;
}

function applyPaletteOverride(
  variant: DesignVariantSchema,
  palette?: DesignVariantSchema["palette"],
): DesignVariantSchema {
  if (!palette) {
    return variant;
  }

  return {
    ...variant,
    palette,
    furniture: variant.furniture.map((item, index) => ({
      ...item,
      color: item.assetId === "sofa" || item.assetId === "bed"
        ? palette.textile
        : index % 2 === 0
          ? palette.accent
          : item.color,
    })),
  };
}

function createDesignVariantJsonSchema(roomIds: string[]): Record<string, unknown> {
  const safeRoomIds = roomIds.length ? roomIds : ["room"];
  const colorSchema = {
    type: "string",
    pattern: "^#[0-9A-Fa-f]{6}$",
  };
  const positionSchema = {
    type: "object",
    additionalProperties: false,
    required: ["x", "y", "z"],
    properties: {
      x: { type: "number" },
      y: { type: "number" },
      z: { type: "number" },
    },
  };
  const scaleSchema = {
    type: "object",
    additionalProperties: false,
    required: ["x", "y", "z"],
    properties: {
      x: { type: "number", exclusiveMinimum: 0 },
      y: { type: "number", exclusiveMinimum: 0 },
      z: { type: "number", exclusiveMinimum: 0 },
    },
  };

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "name",
      "style",
      "palette",
      "roomNotes",
      "furniture",
      "warnings",
      "rationale",
      "intent",
    ],
    properties: {
      name: { type: "string", maxLength: 60 },
      style: { type: "string", maxLength: 100 },
      palette: {
        type: "object",
        additionalProperties: false,
        required: ["wall", "floor", "accent", "textile"],
        properties: {
          wall: colorSchema,
          floor: colorSchema,
          accent: colorSchema,
          textile: colorSchema,
        },
      },
      roomNotes: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["roomId", "summary", "changes"],
          properties: {
            roomId: { type: "string", enum: safeRoomIds },
            summary: { type: "string", maxLength: 120 },
            changes: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: { type: "string", maxLength: 90 },
            },
          },
        },
      },
      furniture: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "assetId", "roomId", "position", "rotationY", "scale"],
          properties: {
            id: { type: "string", maxLength: 60 },
            assetId: {
              type: "string",
              enum: ["sofa", "table", "desk", "bed", "chair"],
            },
            roomId: { type: "string", enum: safeRoomIds },
            position: positionSchema,
            rotationY: { type: "number" },
            scale: scaleSchema,
            color: colorSchema,
          },
        },
      },
      warnings: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        items: { type: "string", maxLength: 140 },
      },
      rationale: { type: "string", maxLength: 220 },
      intent: {
        type: "object",
        additionalProperties: false,
        required: [
          "budgetLevel",
          "useIntent",
          "householdType",
          "roomPriorities",
        ],
        properties: {
          budgetLevel: {
            type: "string",
            enum: ["lean", "balanced", "premium"],
          },
          useIntent: { type: "string", maxLength: 80 },
          householdType: { type: "string", maxLength: 80 },
          roomPriorities: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string", enum: safeRoomIds },
          },
        },
      },
    },
  };
}
