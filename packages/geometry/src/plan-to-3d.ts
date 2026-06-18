import type { PlanSchema, Wall } from "@renovation-twin/types";

export type WallMeshSpec = {
  id: string;
  center: [number, number, number];
  size: [number, number, number];
  rotationY: number;
};

export function pxToMeters(valuePx: number, scalePxPerMeter: number): number {
  return valuePx / scalePxPerMeter;
}

export function wallToMeshSpec(wall: Wall, scalePxPerMeter: number): WallMeshSpec {
  const startX = pxToMeters(wall.start.x, scalePxPerMeter);
  const startZ = pxToMeters(wall.start.y, scalePxPerMeter);
  const endX = pxToMeters(wall.end.x, scalePxPerMeter);
  const endZ = pxToMeters(wall.end.y, scalePxPerMeter);
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
