import type { DesignVariantSchema, PlanSchema } from "@renovation-twin/types";

export const londonFlatPlan: PlanSchema = {
  units: "m",
  scalePxPerMeter: 70,
  image: {
    widthPx: 980,
    heightPx: 700,
    url: "/demo/floorplans/london-flat.svg"
  },
  walls: [
    { id: "w-outer-n", start: { x: 80, y: 70 }, end: { x: 900, y: 70 }, thicknessM: 0.18, heightM: 2.6 },
    { id: "w-outer-e", start: { x: 900, y: 70 }, end: { x: 900, y: 620 }, thicknessM: 0.18, heightM: 2.6 },
    { id: "w-outer-s", start: { x: 900, y: 620 }, end: { x: 80, y: 620 }, thicknessM: 0.18, heightM: 2.6 },
    { id: "w-outer-w", start: { x: 80, y: 620 }, end: { x: 80, y: 70 }, thicknessM: 0.18, heightM: 2.6 },
    { id: "w-bed-1", start: { x: 360, y: 70 }, end: { x: 360, y: 330 }, thicknessM: 0.14, heightM: 2.6 },
    { id: "w-bed-2", start: { x: 620, y: 70 }, end: { x: 620, y: 330 }, thicknessM: 0.14, heightM: 2.6 },
    { id: "w-hall-1", start: { x: 80, y: 330 }, end: { x: 620, y: 330 }, thicknessM: 0.14, heightM: 2.6 },
    { id: "w-bath", start: { x: 250, y: 330 }, end: { x: 250, y: 620 }, thicknessM: 0.14, heightM: 2.6 },
    { id: "w-kitchen", start: { x: 620, y: 330 }, end: { x: 620, y: 620 }, thicknessM: 0.14, heightM: 2.6 },
    { id: "w-store", start: { x: 430, y: 330 }, end: { x: 430, y: 620 }, thicknessM: 0.14, heightM: 2.6 }
  ],
  openings: [
    { id: "d-entry", type: "door", wallId: "w-outer-s", offsetM: 2.1, widthM: 0.9, heightM: 2.1 },
    { id: "d-bed-1", type: "door", wallId: "w-hall-1", offsetM: 3.4, widthM: 0.8, heightM: 2.1 },
    { id: "d-bed-2", type: "door", wallId: "w-hall-1", offsetM: 7.0, widthM: 0.8, heightM: 2.1 },
    { id: "win-living", type: "window", wallId: "w-outer-e", offsetM: 4.2, widthM: 1.8, heightM: 1.2, sillHeightM: 0.9 },
    { id: "win-bed-1", type: "window", wallId: "w-outer-n", offsetM: 2.3, widthM: 1.4, heightM: 1.2, sillHeightM: 0.9 },
    { id: "win-bed-2", type: "window", wallId: "w-outer-n", offsetM: 7.6, widthM: 1.4, heightM: 1.2, sillHeightM: 0.9 }
  ],
  rooms: [
    { id: "living", label: "Living / dining", polygon: [{ x: 620, y: 330 }, { x: 900, y: 330 }, { x: 900, y: 620 }, { x: 620, y: 620 }], areaM2: 16.4, floorMaterial: "oak" },
    { id: "kitchen", label: "Kitchen", polygon: [{ x: 430, y: 330 }, { x: 620, y: 330 }, { x: 620, y: 620 }, { x: 430, y: 620 }], areaM2: 9.0, floorMaterial: "tile" },
    { id: "bath", label: "Bathroom", polygon: [{ x: 80, y: 330 }, { x: 250, y: 330 }, { x: 250, y: 620 }, { x: 80, y: 620 }], areaM2: 6.8, floorMaterial: "tile" },
    { id: "bed-1", label: "Bedroom", polygon: [{ x: 80, y: 70 }, { x: 360, y: 70 }, { x: 360, y: 330 }, { x: 80, y: 330 }], areaM2: 14.9, floorMaterial: "carpet" },
    { id: "bed-2", label: "Office / guest", polygon: [{ x: 360, y: 70 }, { x: 620, y: 70 }, { x: 620, y: 330 }, { x: 360, y: 330 }], areaM2: 13.8, floorMaterial: "oak" },
    { id: "hall", label: "Hall", polygon: [{ x: 250, y: 330 }, { x: 430, y: 330 }, { x: 430, y: 620 }, { x: 250, y: 620 }], areaM2: 8.1, floorMaterial: "oak" }
  ]
};

export const londonFlatVariants: DesignVariantSchema[] = [
  {
    name: "Warm Minimal",
    style: "Japandi calm",
    palette: { wall: "#f7f2e8", floor: "#cfae7b", accent: "#56675b", textile: "#d9c7b1" },
    roomNotes: [
      { roomId: "living", summary: "Soft neutral lounge with hidden storage.", changes: ["Low linen sofa", "Oak dining bench", "Olive accent wall"] },
      { roomId: "bed-2", summary: "Calm work and guest room.", changes: ["Wall desk", "Fold-out daybed", "Warm task lighting"] }
    ],
    furniture: [
      { id: "sofa-1", assetId: "sofa", roomId: "living", position: { x: 10.4, y: 0.35, z: 7.4 }, rotationY: 0, scale: { x: 2.1, y: 0.7, z: 0.9 }, color: "#d9c7b1" },
      { id: "table-1", assetId: "table", roomId: "living", position: { x: 11.7, y: 0.38, z: 6.1 }, rotationY: 0, scale: { x: 1.2, y: 0.75, z: 0.8 }, color: "#7b5f43" },
      { id: "desk-1", assetId: "desk", roomId: "bed-2", position: { x: 7.1, y: 0.38, z: 2.0 }, rotationY: 0, scale: { x: 1.4, y: 0.75, z: 0.55 }, color: "#7b5f43" }
    ],
    warnings: ["Concept visualisation only. Structural feasibility must be checked by a qualified professional."]
  },
  {
    name: "Rental Staging",
    style: "Bright resilient staging",
    palette: { wall: "#f8fafc", floor: "#a88b62", accent: "#2f6f9f", textile: "#e5e7eb" },
    roomNotes: [
      { roomId: "living", summary: "Durable, bright furniture plan for listing photos.", changes: ["Compact sofa", "Round dining table", "Blue art wall"] },
      { roomId: "bed-1", summary: "Simple hotel-like bedroom.", changes: ["Neutral bedlinen", "Slim wardrobes", "Wall sconces"] }
    ],
    furniture: [
      { id: "sofa-2", assetId: "sofa", roomId: "living", position: { x: 10.1, y: 0.35, z: 7.8 }, rotationY: 0, scale: { x: 1.8, y: 0.7, z: 0.85 }, color: "#e5e7eb" },
      { id: "dining-2", assetId: "table", roomId: "living", position: { x: 12.0, y: 0.38, z: 5.9 }, rotationY: 0, scale: { x: 0.95, y: 0.75, z: 0.95 }, color: "#2f6f9f" },
      { id: "bed-2", assetId: "bed", roomId: "bed-1", position: { x: 2.6, y: 0.32, z: 1.9 }, rotationY: 0, scale: { x: 1.6, y: 0.55, z: 2.0 }, color: "#e5e7eb" }
    ],
    warnings: ["Furniture sizes are conceptual and should be checked before purchase."]
  }
];
