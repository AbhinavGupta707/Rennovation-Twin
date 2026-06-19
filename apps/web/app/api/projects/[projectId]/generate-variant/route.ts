import { DesignVariantSchemaZ } from "@renovation-twin/types";
import { Events, trackEvent } from "@renovation-twin/events";
import {
  createFallbackVariantForPlan,
  runJsonModel,
  sanitizeVariantForPlan,
} from "@renovation-twin/ai";
import {
  getProjectOrDemo,
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
  };
  const project = getProjectOrDemo(projectId);
  const prompt =
    body.prompt?.trim() || "Create a polished, practical renovation concept.";
  const stylePreset = body.stylePreset?.trim() || "Warm Minimal";
  const validRoomIds = new Set(project.plan.rooms.map((room) => room.id));
  const intent = {
    budgetLevel: normalizeBudgetLevel(body.budgetLevel),
    useIntent: body.useIntent?.trim() || "flexible living",
    householdType: body.householdType?.trim() || "mixed household",
    roomPriorities: normalizeRoomPriorities(body.roomPriorities).filter(
      (roomId) => validRoomIds.has(roomId),
    ),
  };

  trackEvent(
    Events.VariantPromptSubmitted,
    {
      projectId,
      stylePreset,
      promptLength: prompt.length,
      budgetLevel: intent.budgetLevel,
      useIntent: intent.useIntent,
      householdType: intent.householdType,
      roomPriorityCount: intent.roomPriorities.length,
    },
    project.id,
  );

  let variant;
  let provider: "fireworks" | "fallback" = "fireworks";
  let warning: string | undefined;

  try {
    variant = await runJsonModel({
      schema: DesignVariantSchemaZ,
      system:
        "You create practical interior design variants from structured floor-plan JSON. Return only valid JSON matching the requested schema. Never claim structural feasibility.",
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
        requiredOutput:
          "Return a DesignVariantSchema JSON object with palette, roomNotes, furniture, warnings, rationale, and intent. Furniture roomId values must use only the provided room ids.",
      }),
    });
    variant = sanitizeVariantForPlan(variant, project.plan, intent);
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
  }

  saveVariant(project.id, variant, {
    provider,
    usedFallback: provider === "fallback",
    budgetLevel: intent.budgetLevel,
    useIntent: intent.useIntent,
    householdType: intent.householdType,
    roomPriorityCount: intent.roomPriorities.length,
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
