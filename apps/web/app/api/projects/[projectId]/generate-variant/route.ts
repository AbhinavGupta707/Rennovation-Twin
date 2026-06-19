import { londonFlatVariants } from "@renovation-twin/fixtures";
import { DesignVariantSchemaZ } from "@renovation-twin/types";
import { Events, trackEvent } from "@renovation-twin/events";
import { getFallbackVariant, runJsonModel } from "@renovation-twin/ai";
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
  };
  const project = getProjectOrDemo(projectId);
  const prompt =
    body.prompt?.trim() || "Create a polished, practical renovation concept.";
  const stylePreset = body.stylePreset?.trim() || "Warm Minimal";

  trackEvent(
    Events.VariantPromptSubmitted,
    {
      projectId,
      stylePreset,
      promptLength: prompt.length,
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
      }),
    });
  } catch (error) {
    provider = "fallback";
    warning =
      error instanceof Error ? error.message : "Fireworks generation failed.";
    const fallbackVariant = getFallbackVariant(
      londonFlatVariants,
      project.variants.length,
    );
    variant = {
      ...fallbackVariant,
      name: stylePreset,
      warnings: [
        ...fallbackVariant.warnings,
        "Generated from deterministic fallback because the AI provider is not configured or unavailable.",
      ],
    };
  }

  saveVariant(project.id, variant, {
    provider,
    usedFallback: provider === "fallback",
  });

  return jsonOk({
    variantId: `${project.id}-${variant.name.toLowerCase().replaceAll(" ", "-")}`,
    variant,
    provider,
    warning,
  });
}
