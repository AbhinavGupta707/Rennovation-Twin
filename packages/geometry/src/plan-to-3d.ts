import type { Opening, PlanSchema, Room, Vec2, Wall } from "@renovation-twin/types";

export type WallMeshSpec = {
  id: string;
  center: [number, number, number];
  size: [number, number, number];
  rotationY: number;
};

export type FloorPlaneSpec = {
  center: [number, number, number];
  size: [number, number];
};

export type OpeningMarkerSpec = {
  id: string;
  type: Opening["type"];
  center: [number, number, number];
  size: [number, number, number];
  rotationY: number;
};

export type RoomLabelSpec = {
  id: string;
  label: string;
  position: [number, number, number];
  areaM2?: number;
};

export type PlanSceneSpec = {
  bounds: ReturnType<typeof getPlanBoundsMeters>;
  floor: FloorPlaneSpec;
  walls: WallMeshSpec[];
  openings: OpeningMarkerSpec[];
  roomLabels: RoomLabelSpec[];
};

export function pxToMeters(valuePx: number, scalePxPerMeter: number): number {
  return valuePx / scalePxPerMeter;
}

export function pointToMeters(point: Vec2, scalePxPerMeter: number): { x: number; z: number } {
  return {
    x: pxToMeters(point.x, scalePxPerMeter),
    z: pxToMeters(point.y, scalePxPerMeter)
  };
}

export function wallToMeshSpec(wall: Wall, scalePxPerMeter: number): WallMeshSpec {
  const { x: startX, z: startZ } = pointToMeters(wall.start, scalePxPerMeter);
  const { x: endX, z: endZ } = pointToMeters(wall.end, scalePxPerMeter);
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dz);

  return {
    id: wall.id,
    center: [startX + dx / 2, wall.heightM / 2, startZ + dz / 2],
    size: [length, wall.heightM, wall.thicknessM],
    rotationY: -Math.atan2(dz, dx)
  };
}

export function planToWallMeshSpecs(plan: PlanSchema): WallMeshSpec[] {
  return plan.walls.map((wall) => wallToMeshSpec(wall, plan.scalePxPerMeter));
}

export function getPlanBoundsMeters(plan: PlanSchema) {
  return {
    widthM: pxToMeters(plan.image.widthPx, plan.scalePxPerMeter),
    depthM: pxToMeters(plan.image.heightPx, plan.scalePxPerMeter)
  };
}

export function planToFloorPlaneSpec(plan: PlanSchema): FloorPlaneSpec {
  const bounds = getPlanBoundsMeters(plan);

  return {
    center: [bounds.widthM / 2, 0, bounds.depthM / 2],
    size: [bounds.widthM, bounds.depthM]
  };
}

export function openingToMarkerSpec(
  opening: Opening,
  wall: Wall,
  scalePxPerMeter: number
): OpeningMarkerSpec {
  const { x: startX, z: startZ } = pointToMeters(wall.start, scalePxPerMeter);
  const { x: endX, z: endZ } = pointToMeters(wall.end, scalePxPerMeter);
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.max(Math.hypot(dx, dz), 0.001);
  const alongX = dx / length;
  const alongZ = dz / length;
  const normalX = -alongZ;
  const normalZ = alongX;
  const clampedOffset = Math.min(Math.max(opening.offsetM, 0), length);
  const markerDepth = 0.05;
  const markerY =
    opening.type === "door"
      ? opening.heightM / 2
      : (opening.sillHeightM ?? 0.9) + opening.heightM / 2;

  return {
    id: opening.id,
    type: opening.type,
    center: [
      startX + alongX * clampedOffset + normalX * (wall.thicknessM / 2 + markerDepth),
      markerY,
      startZ + alongZ * clampedOffset + normalZ * (wall.thicknessM / 2 + markerDepth)
    ],
    size: [opening.widthM, opening.heightM, markerDepth],
    rotationY: -Math.atan2(dz, dx)
  };
}

export function planToOpeningMarkerSpecs(plan: PlanSchema): OpeningMarkerSpec[] {
  const wallById = new Map(plan.walls.map((wall) => [wall.id, wall]));

  return plan.openings.flatMap((opening) => {
    const wall = wallById.get(opening.wallId);

    if (!wall) {
      return [];
    }

    return [openingToMarkerSpec(opening, wall, plan.scalePxPerMeter)];
  });
}

export function polygonCentroid(points: Vec2[]): Vec2 {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  let twiceArea = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const cross = current.x * next.y - next.x * current.y;

    twiceArea += cross;
    centroidX += (current.x + next.x) * cross;
    centroidY += (current.y + next.y) * cross;
  }

  if (Math.abs(twiceArea) < 0.001) {
    const sum = points.reduce(
      (accumulator, point) => ({
        x: accumulator.x + point.x,
        y: accumulator.y + point.y
      }),
      { x: 0, y: 0 }
    );

    return {
      x: sum.x / points.length,
      y: sum.y / points.length
    };
  }

  return {
    x: centroidX / (3 * twiceArea),
    y: centroidY / (3 * twiceArea)
  };
}

export function roomToLabelSpec(room: Room, scalePxPerMeter: number): RoomLabelSpec {
  const centroid = polygonCentroid(room.polygon);
  const { x, z } = pointToMeters(centroid, scalePxPerMeter);

  return {
    id: room.id,
    label: room.label,
    position: [x, 0.08, z],
    areaM2: room.areaM2
  };
}

export function planToRoomLabelSpecs(plan: PlanSchema): RoomLabelSpec[] {
  return plan.rooms.map((room) => roomToLabelSpec(room, plan.scalePxPerMeter));
}

export function planToSceneSpec(plan: PlanSchema): PlanSceneSpec {
  return {
    bounds: getPlanBoundsMeters(plan),
    floor: planToFloorPlaneSpec(plan),
    walls: planToWallMeshSpecs(plan),
    openings: planToOpeningMarkerSpecs(plan),
    roomLabels: planToRoomLabelSpecs(plan)
  };
}
