import { z } from "zod";

export const Vec2Schema = z.object({
  x: z.number(),
  y: z.number()
});

export const WallSchema = z.object({
  id: z.string(),
  start: Vec2Schema,
  end: Vec2Schema,
  thicknessM: z.number().positive().default(0.16),
  heightM: z.number().positive().default(2.6),
  roomIds: z.array(z.string()).optional()
});

export const OpeningSchema = z.object({
  id: z.string(),
  type: z.enum(["door", "window"]),
  wallId: z.string(),
  offsetM: z.number().nonnegative(),
  widthM: z.number().positive(),
  heightM: z.number().positive(),
  sillHeightM: z.number().nonnegative().optional()
});

export const RoomSchema = z.object({
  id: z.string(),
  label: z.string(),
  polygon: z.array(Vec2Schema).min(3),
  areaM2: z.number().positive().optional(),
  floorMaterial: z.string().optional()
});

export const PlanSchemaZ = z.object({
  units: z.literal("m"),
  scalePxPerMeter: z.number().positive(),
  image: z.object({
    widthPx: z.number().positive(),
    heightPx: z.number().positive(),
    url: z.string()
  }),
  walls: z.array(WallSchema),
  openings: z.array(OpeningSchema),
  rooms: z.array(RoomSchema)
});

export const FurnitureItemSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  roomId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  }),
  rotationY: z.number(),
  scale: z.object({
    x: z.number().positive(),
    y: z.number().positive(),
    z: z.number().positive()
  }),
  color: z.string().optional()
});

export const DesignVariantSchemaZ = z.object({
  name: z.string(),
  style: z.string(),
  palette: z.object({
    wall: z.string(),
    floor: z.string(),
    accent: z.string(),
    textile: z.string()
  }),
  roomNotes: z.array(
    z.object({
      roomId: z.string(),
      summary: z.string(),
      changes: z.array(z.string())
    })
  ),
  furniture: z.array(FurnitureItemSchema),
  warnings: z.array(z.string())
});

export type Vec2 = z.infer<typeof Vec2Schema>;
export type Wall = z.infer<typeof WallSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type PlanSchema = z.infer<typeof PlanSchemaZ>;
export type FurnitureItem = z.infer<typeof FurnitureItemSchema>;
export type DesignVariantSchema = z.infer<typeof DesignVariantSchemaZ>;
