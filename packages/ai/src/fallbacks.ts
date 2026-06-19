import type {
  DesignVariantIntent,
  DesignVariantSchema,
  FurnitureItem,
  PlanSchema,
  Room,
} from "@renovation-twin/types";

export function getFallbackVariant(variants: DesignVariantSchema[], index = 0): DesignVariantSchema {
  if (!variants.length) {
    throw new Error("No fallback variants are available.");
  }

  return variants[index % variants.length]!;
}

export type VariantGenerationContext = {
  stylePreset: string;
  prompt: string;
  intent: DesignVariantIntent;
};

const paletteByBudget: Record<
  NonNullable<DesignVariantIntent["budgetLevel"]>,
  DesignVariantSchema["palette"]
> = {
  lean: {
    wall: "#f8fafc",
    floor: "#b89d74",
    accent: "#2f6f9f",
    textile: "#e5e7eb",
  },
  balanced: {
    wall: "#f7f2e8",
    floor: "#cfae7b",
    accent: "#56675b",
    textile: "#d9c7b1",
  },
  premium: {
    wall: "#f4efe6",
    floor: "#8f7453",
    accent: "#1f2933",
    textile: "#c9b8a4",
  },
};

export function createFallbackVariantForPlan(
  plan: PlanSchema,
  context: VariantGenerationContext,
  index = 0,
): DesignVariantSchema {
  const budgetLevel = context.intent.budgetLevel ?? "balanced";
  const prioritizedRooms = prioritizeRooms(plan.rooms, context.intent);
  const palette = paletteByBudget[budgetLevel];
  const style = `${context.stylePreset} · ${describeIntent(context.intent)}`;
  const roomNotes = prioritizedRooms.slice(0, 5).map((room) => ({
    roomId: room.id,
    summary: summarizeRoom(room, context.intent, budgetLevel),
    changes: createRoomChanges(room, context.intent, budgetLevel),
  }));

  return sanitizeVariantForPlan(
    {
      name: context.stylePreset,
      style,
      palette,
      roomNotes,
      furniture: createFurnitureForRooms(plan, prioritizedRooms, index, palette),
      warnings: [
        "Generated from deterministic fallback because the AI provider is not configured or unavailable.",
        "Concept visualisation only. Structural feasibility must be checked by a qualified professional.",
      ],
      rationale: createRationale(context.intent, context.prompt, budgetLevel),
      intent: context.intent,
    },
    plan,
    context.intent,
  );
}

export function sanitizeVariantForPlan(
  variant: DesignVariantSchema,
  plan: PlanSchema,
  intent: DesignVariantIntent = {},
): DesignVariantSchema {
  const validRoomIds = new Set(plan.rooms.map((room) => room.id));
  const warnings = [...variant.warnings];
  const furniture = variant.furniture.filter((item) => {
    const valid = validRoomIds.has(item.roomId);
    if (!valid) {
      warnings.push(`Dropped furniture item "${item.id}" because room "${item.roomId}" does not exist in this plan.`);
    }
    return valid;
  });
  const roomNotes = variant.roomNotes.filter((note) => {
    const valid = validRoomIds.has(note.roomId);
    if (!valid) {
      warnings.push(`Dropped room note for missing room "${note.roomId}".`);
    }
    return valid;
  });

  const fallbackRooms = prioritizeRooms(plan.rooms, intent);
  const safeRoomNotes =
    roomNotes.length > 0
      ? roomNotes
      : fallbackRooms.slice(0, 3).map((room) => ({
          roomId: room.id,
          summary: summarizeRoom(room, intent, intent.budgetLevel ?? "balanced"),
          changes: createRoomChanges(
            room,
            intent,
            intent.budgetLevel ?? "balanced",
          ),
        }));

  return {
    ...variant,
    roomNotes: safeRoomNotes,
    furniture,
    warnings: Array.from(new Set(warnings)),
    rationale: variant.rationale ?? createRationale(intent, "", intent.budgetLevel ?? "balanced"),
    intent,
  };
}

function prioritizeRooms(rooms: Room[], intent: DesignVariantIntent): Room[] {
  const priorityIds = intent.roomPriorities ?? [];
  return [...rooms].sort((a, b) => {
    const aIndex = priorityIds.indexOf(a.id);
    const bIndex = priorityIds.indexOf(b.id);

    if (aIndex === -1 && bIndex === -1) {
      return 0;
    }
    if (aIndex === -1) {
      return 1;
    }
    if (bIndex === -1) {
      return -1;
    }
    return aIndex - bIndex;
  });
}

function createFurnitureForRooms(
  plan: PlanSchema,
  rooms: Room[],
  index: number,
  palette: DesignVariantSchema["palette"],
): FurnitureItem[] {
  return rooms.slice(0, 5).flatMap((room, roomIndex) => {
    const center = roomCenterMeters(room, plan);
    const assetId = chooseAssetForRoom(room, roomIndex + index);
    const scale =
      assetId === "bed"
        ? { x: 1.55, y: 0.55, z: 1.95 }
        : assetId === "desk"
          ? { x: 1.28, y: 0.72, z: 0.58 }
          : assetId === "sofa"
            ? { x: 1.85, y: 0.68, z: 0.86 }
            : { x: 0.95, y: 0.72, z: 0.72 };

    return [
      {
        id: `fallback-${room.id}-${assetId}`,
        assetId,
        roomId: room.id,
        position: {
          x: center.x,
          y: assetId === "bed" ? 0.32 : 0.38,
          z: center.z,
        },
        rotationY: roomIndex % 2 === 0 ? 0 : Math.PI / 2,
        scale,
        color: roomIndex % 2 === 0 ? palette.textile : palette.accent,
      },
    ];
  });
}

function roomCenterMeters(room: Room, plan: PlanSchema) {
  const center = room.polygon.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x / room.polygon.length,
      y: accumulator.y + point.y / room.polygon.length,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: center.x / plan.scalePxPerMeter,
    z: center.y / plan.scalePxPerMeter,
  };
}

function chooseAssetForRoom(room: Room, index: number) {
  const label = room.label.toLowerCase();

  if (label.includes("bed")) {
    return "bed";
  }
  if (label.includes("office") || label.includes("guest")) {
    return "desk";
  }
  if (label.includes("living") || label.includes("dining")) {
    return "sofa";
  }

  return index % 2 === 0 ? "table" : "chair";
}

function summarizeRoom(
  room: Room,
  intent: DesignVariantIntent,
  budgetLevel: NonNullable<DesignVariantIntent["budgetLevel"]>,
) {
  const useIntent = intent.useIntent ?? "flexible living";
  return `${room.label} is tuned for ${useIntent} with a ${budgetLevel} intervention level.`;
}

function createRoomChanges(
  room: Room,
  intent: DesignVariantIntent,
  budgetLevel: NonNullable<DesignVariantIntent["budgetLevel"]>,
) {
  const changes = [
    budgetLevel === "lean"
      ? "Reuse core furniture footprint"
      : budgetLevel === "premium"
        ? "Upgrade finishes and layered lighting"
        : "Balance new hero pieces with retained basics",
    `Plan around ${intent.householdType ?? "the household"} circulation`,
  ];

  if (room.label.toLowerCase().includes("office")) {
    changes.push("Add a dedicated work zone with closed storage");
  } else if (room.label.toLowerCase().includes("living")) {
    changes.push("Create a camera-ready seating and dining composition");
  } else {
    changes.push("Keep furniture clear of door and window markers");
  }

  return changes;
}

function describeIntent(intent: DesignVariantIntent) {
  return [
    intent.useIntent ?? "flexible concept",
    intent.householdType ?? "general household",
    `${intent.budgetLevel ?? "balanced"} budget`,
  ].join(", ");
}

function createRationale(
  intent: DesignVariantIntent,
  prompt: string,
  budgetLevel: NonNullable<DesignVariantIntent["budgetLevel"]>,
) {
  const roomCount = intent.roomPriorities?.length ?? 0;
  const promptHint = prompt.trim()
    ? " It also respects the user prompt without changing the structural plan."
    : "";

  return `Fits a ${budgetLevel} budget, ${intent.householdType ?? "general household"} use, and ${intent.useIntent ?? "flexible living"} intent across ${roomCount || "the"} priority rooms.${promptHint}`;
}
