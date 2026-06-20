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
  const roomBoundsById = new Map(
    plan.rooms.map((room) => [room.id, getRoomBounds(room, plan)]),
  );
  const furnitureRoomIndexes = new Map<string, number>();
  const warnings = [...variant.warnings];
  const furniture = variant.furniture.flatMap((item) => {
    const valid = validRoomIds.has(item.roomId);
    if (!valid) {
      warnings.push(`Dropped furniture item "${item.id}" because room "${item.roomId}" does not exist in this plan.`);
      return [];
    }

    const roomBounds = roomBoundsById.get(item.roomId);

    if (!roomBounds) {
      return [];
    }

    const roomIndex = furnitureRoomIndexes.get(item.roomId) ?? 0;
    furnitureRoomIndexes.set(item.roomId, roomIndex + 1);

    return [normalizeFurnitureItemForRoom(item, roomBounds, roomIndex)];
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
  const safeFurniture =
    furniture.length > 0
      ? furniture
      : createFurnitureForRooms(plan, fallbackRooms, 0, variant.palette);

  return {
    ...variant,
    roomNotes: safeRoomNotes,
    furniture: safeFurniture,
    warnings: Array.from(new Set(warnings)),
    rationale: variant.rationale ?? createRationale(intent, "", intent.budgetLevel ?? "balanced"),
    intent,
  };
}

type RoomBounds = {
  id: string;
  label: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  center: { x: number; z: number };
  width: number;
  depth: number;
};

function getRoomBounds(room: Room, plan: PlanSchema): RoomBounds {
  const points = room.polygon.map((point) => ({
    x: point.x / plan.scalePxPerMeter,
    z: point.y / plan.scalePxPerMeter,
  }));
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const width = Math.max(maxX - minX, 0.1);
  const depth = Math.max(maxZ - minZ, 0.1);

  return {
    id: room.id,
    label: room.label,
    minX,
    maxX,
    minZ,
    maxZ,
    center: { x: minX + width / 2, z: minZ + depth / 2 },
    width,
    depth,
  };
}

function normalizeFurnitureItemForRoom(
  item: FurnitureItem,
  room: RoomBounds,
  index: number,
): FurnitureItem {
  const assetId = normalizeFurnitureAssetId(item.assetId, room, index);
  const scale = normalizeFurnitureScale(assetId, item.scale, room);
  const layout = createFurnitureLayout(room, assetId, index, scale);
  const shouldReposition = !isFurnitureInsideRoom(item, room, scale);
  const position = clampFurniturePosition(
    shouldReposition ? layout.position : item.position,
    room,
    scale,
  );

  return {
    ...item,
    assetId,
    position: {
      x: position.x,
      y: getFurnitureY(assetId),
      z: position.z,
    },
    rotationY: shouldReposition
      ? layout.rotationY
      : normalizeFiniteNumber(item.rotationY, layout.rotationY),
    scale,
  };
}

function normalizeFurnitureAssetId(
  assetId: string,
  room: RoomBounds,
  index: number,
) {
  const normalized = assetId.toLowerCase();

  if (
    normalized === "sofa" ||
    normalized === "table" ||
    normalized === "desk" ||
    normalized === "bed" ||
    normalized === "chair" ||
    normalized === "rug" ||
    normalized === "plant"
  ) {
    return normalized;
  }

  return chooseAssetForRoom({ id: room.id, label: room.label, polygon: [] }, index);
}

function normalizeFurnitureScale(
  assetId: string,
  scale: FurnitureItem["scale"],
  room: RoomBounds,
): FurnitureItem["scale"] {
  const defaults = getFurnitureDefaults(assetId);
  const maxWidth = Math.max(0.38, room.width - 0.72);
  const maxDepth = Math.max(0.38, room.depth - 0.72);

  return {
    x: clampNumber(normalizeFiniteNumber(scale.x, defaults.x), 0.28, maxWidth),
    y: clampNumber(normalizeFiniteNumber(scale.y, defaults.y), 0.12, 1.25),
    z: clampNumber(normalizeFiniteNumber(scale.z, defaults.z), 0.28, maxDepth),
  };
}

function getFurnitureDefaults(assetId: string): FurnitureItem["scale"] {
  switch (assetId) {
    case "bed":
      return { x: 1.55, y: 0.55, z: 1.95 };
    case "desk":
      return { x: 1.28, y: 0.72, z: 0.58 };
    case "chair":
      return { x: 0.68, y: 0.72, z: 0.68 };
    case "rug":
      return { x: 1.8, y: 0.08, z: 1.2 };
    case "plant":
      return { x: 0.55, y: 1, z: 0.55 };
    case "table":
      return { x: 0.95, y: 0.72, z: 0.95 };
    case "sofa":
    default:
      return { x: 1.85, y: 0.68, z: 0.86 };
  }
}

function createFurnitureLayout(
  room: RoomBounds,
  assetId: string,
  index: number,
  scale: FurnitureItem["scale"],
) {
  const insetX = Math.min(Math.max(scale.x * 0.65, 0.42), room.width * 0.34);
  const insetZ = Math.min(Math.max(scale.z * 0.65, 0.42), room.depth * 0.34);
  const nudge = (index % 3 - 1) * 0.35;

  if (assetId === "bed") {
    return {
      position: { x: room.center.x + nudge, z: room.minZ + insetZ },
      rotationY: 0,
    };
  }
  if (assetId === "desk") {
    return {
      position: { x: room.maxX - insetX, z: room.center.z + nudge },
      rotationY: Math.PI / 2,
    };
  }
  if (assetId === "sofa") {
    return {
      position: { x: room.center.x + nudge, z: room.maxZ - insetZ },
      rotationY: 0,
    };
  }

  return {
    position: { x: room.center.x + nudge, z: room.center.z },
    rotationY: index % 2 === 0 ? 0 : Math.PI / 2,
  };
}

function isFurnitureInsideRoom(
  item: FurnitureItem,
  room: RoomBounds,
  scale: FurnitureItem["scale"],
) {
  const paddingX = Math.min(scale.x / 2 + 0.12, room.width / 2);
  const paddingZ = Math.min(scale.z / 2 + 0.12, room.depth / 2);

  return (
    Number.isFinite(item.position.x) &&
    Number.isFinite(item.position.z) &&
    item.position.x >= room.minX + paddingX &&
    item.position.x <= room.maxX - paddingX &&
    item.position.z >= room.minZ + paddingZ &&
    item.position.z <= room.maxZ - paddingZ
  );
}

function clampFurniturePosition(
  position: { x: number; z: number },
  room: RoomBounds,
  scale: FurnitureItem["scale"],
) {
  const paddingX = Math.min(scale.x / 2 + 0.18, Math.max(room.width / 2 - 0.02, 0));
  const paddingZ = Math.min(scale.z / 2 + 0.18, Math.max(room.depth / 2 - 0.02, 0));

  return {
    x: clampNumber(
      normalizeFiniteNumber(position.x, room.center.x),
      room.minX + paddingX,
      room.maxX - paddingX,
    ),
    z: clampNumber(
      normalizeFiniteNumber(position.z, room.center.z),
      room.minZ + paddingZ,
      room.maxZ - paddingZ,
    ),
  };
}

function getFurnitureY(assetId: string) {
  if (assetId === "bed") {
    return 0.32;
  }
  if (assetId === "chair") {
    return 0.34;
  }
  if (assetId === "rug") {
    return 0.04;
  }
  if (assetId === "plant") {
    return 0.5;
  }

  return 0.38;
}

function normalizeFiniteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  if (min > max) {
    return (min + max) / 2;
  }

  return Math.min(Math.max(value, min), max);
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
