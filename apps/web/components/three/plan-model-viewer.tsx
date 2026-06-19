"use client";

import {
  type ElementRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Html, OrbitControls } from "@react-three/drei";
import { Camera, Pause, Play, ScanSearch } from "lucide-react";
import type {
  ApiResponse,
  DesignVariantSchema,
  FurnitureItem,
  PlanSchema,
} from "@renovation-twin/types";
import { planToSceneSpec } from "@renovation-twin/geometry";

const baseVariant: DesignVariantSchema = {
  name: "Survey Base",
  style: "Neutral model",
  palette: {
    wall: "#f5f1e8",
    floor: "#c8a875",
    accent: "#4f6f86",
    textile: "#d8dde0"
  },
  roomNotes: [],
  furniture: [],
  warnings: []
};

type ViewerProps = {
  projectId?: string;
  plan: PlanSchema;
  variants: DesignVariantSchema[];
  initialVariantName?: string;
  readOnly?: boolean;
};

type CameraPreset = {
  id: "overview" | "living" | "bedroom" | "walkthrough";
  label: string;
  description: string;
  position: [number, number, number];
  target: [number, number, number];
};

export function PlanModelViewer({
  projectId,
  plan,
  variants,
  initialVariantName,
  readOnly = false,
}: ViewerProps) {
  const scene = useMemo(() => planToSceneSpec(plan), [plan]);
  const allVariants = useMemo(() => [baseVariant, ...variants], [variants]);
  const defaultVariantName =
    allVariants.find((variant) => variant.name === initialVariantName)?.name ?? allVariants[1]?.name ?? allVariants[0]!.name;
  const [activeVariantName, setActiveVariantName] = useState(defaultVariantName);
  const cameraPresets = useMemo(() => createCameraPresets(scene), [scene]);
  const [activeCameraPresetId, setActiveCameraPresetId] =
    useState<CameraPreset["id"]>("overview");
  const [guidedMode, setGuidedMode] = useState(false);
  const [showRoomLabels, setShowRoomLabels] = useState(false);
  const [captureState, setCaptureState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeVariant = allVariants.find((variant) => variant.name === activeVariantName) ?? allVariants[0]!;
  const furniture =
    activeVariant.furniture.length > 0 ? activeVariant.furniture : createBaseFurniture(plan, activeVariant);
  const activeCameraPreset =
    cameraPresets.find((preset) => preset.id === activeCameraPresetId) ??
    cameraPresets[0]!;

  useEffect(() => {
    if (!guidedMode) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveCameraPresetId((current) => {
        const currentIndex = cameraPresets.findIndex(
          (preset) => preset.id === current,
        );
        return cameraPresets[(currentIndex + 1) % cameraPresets.length]!.id;
      });
    }, 2600);

    return () => window.clearInterval(timer);
  }, [cameraPresets, guidedMode]);

  async function captureScreenshot() {
    if (!projectId || readOnly || !canvasRef.current) {
      return;
    }

    setCaptureState("saving");
    setCaptureMessage("Capturing the current 3D view...");

    try {
      const imageDataUrl = canvasRef.current.toDataURL("image/png");
      const payload = await postJson<{
        screenshot: { id: string; createdAt: string };
      }>(`/api/projects/${projectId}/screenshots`, {
        imageDataUrl,
        variantName: activeVariant.name,
        cameraPreset: activeCameraPreset.label,
      });

      setCaptureState("saved");
      setCaptureMessage(`Screenshot saved for report (${payload.screenshot.id}).`);
    } catch (error) {
      setCaptureState("error");
      setCaptureMessage(
        error instanceof Error ? error.message : "Could not capture screenshot.",
      );
    }
  }

  return (
    <div className="model-viewer">
      <div className="model-controls" aria-label="3D model controls">
        <div className="variant-tabs" aria-label="Design variants">
          {allVariants.map((variant) => (
            <button
              key={variant.name}
              type="button"
              className="variant-tab"
              aria-pressed={variant.name === activeVariant.name}
              onClick={() => {
                setActiveVariantName(variant.name);
                updateVariantUrl(variant.name);
              }}
            >
              {variant.name}
            </button>
          ))}
        </div>
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={showRoomLabels}
            onChange={(event) => setShowRoomLabels(event.currentTarget.checked)}
          />
          Room labels
        </label>
      </div>

      <div className="camera-controls" aria-label="Camera presets">
        {cameraPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="camera-preset"
            aria-pressed={preset.id === activeCameraPreset.id}
            title={preset.description}
            onClick={() => {
              setGuidedMode(false);
              setActiveCameraPresetId(preset.id);
            }}
          >
            <ScanSearch size={16} aria-hidden="true" />
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className="camera-preset"
          aria-pressed={guidedMode}
          onClick={() => setGuidedMode((current) => !current)}
        >
          {guidedMode ? (
            <Pause size={16} aria-hidden="true" />
          ) : (
            <Play size={16} aria-hidden="true" />
          )}
          Guided tour
        </button>
        {!readOnly && projectId ? (
          <button
            type="button"
            className="camera-preset capture-preset"
            disabled={captureState === "saving"}
            onClick={captureScreenshot}
          >
            <Camera size={16} aria-hidden="true" />
            Capture view
          </button>
        ) : null}
      </div>

      {captureMessage ? (
        <p
          className={`capture-message ${captureState === "error" ? "capture-error" : ""}`}
        >
          {captureMessage}
        </p>
      ) : null}

      <div className="model-canvas-shell">
        <Canvas
          shadows
          camera={{ position: activeCameraPreset.position, fov: 42, near: 0.1, far: 100 }}
          dpr={[1, 1.75]}
          gl={{ preserveDrawingBuffer: true }}
          onCreated={({ camera, gl }) => {
            canvasRef.current = gl.domElement;
            camera.lookAt(
              activeCameraPreset.target[0],
              activeCameraPreset.target[1],
              activeCameraPreset.target[2],
            );
          }}
          aria-label="Interactive 3D renovation model"
        >
          <color attach="background" args={["#e9eee7"]} />
          <ambientLight intensity={0.72} />
          <directionalLight
            castShadow
            position={[scene.bounds.widthM * 0.2, 8, scene.bounds.depthM * 0.35]}
            intensity={1.25}
            shadow-mapSize={[1024, 1024]}
          />
          <PlanScene
            scene={scene}
            variant={activeVariant}
            furniture={furniture}
            showRoomLabels={showRoomLabels}
          />
          <CameraControlsRig preset={activeCameraPreset} />
          <Environment preset="apartment" />
        </Canvas>
      </div>

      <div className="model-meta" aria-label="Model statistics">
        <span>{plan.walls.length} walls</span>
        <span>{plan.openings.length} openings</span>
        <span>{furniture.length} furniture pieces</span>
        <span>{activeCameraPreset.label} camera</span>
      </div>
    </div>
  );
}

function CameraControlsRig({ preset }: { preset: CameraPreset }) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls> | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...preset.position);
    camera.lookAt(...preset.target);
    controlsRef.current?.target.set(...preset.target);
    controlsRef.current?.update();
  }, [camera, preset]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={2.2}
      maxDistance={30}
      maxPolarAngle={Math.PI / 2.08}
    />
  );
}

function PlanScene({
  scene,
  variant,
  furniture,
  showRoomLabels
}: {
  scene: ReturnType<typeof planToSceneSpec>;
  variant: DesignVariantSchema;
  furniture: FurnitureItem[];
  showRoomLabels: boolean;
}) {
  return (
    <group>
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={scene.floor.center}
        renderOrder={-1}
      >
        <planeGeometry args={scene.floor.size} />
        <meshStandardMaterial color={variant.palette.floor} roughness={0.82} metalness={0.02} />
      </mesh>

      <gridHelper
        args={[
          Math.max(scene.bounds.widthM, scene.bounds.depthM),
          24,
          "#8d9a91",
          "#ccd5cd"
        ]}
        position={[scene.bounds.widthM / 2, 0.012, scene.bounds.depthM / 2]}
      />

      {scene.walls.map((wall) => (
        <mesh key={wall.id} castShadow receiveShadow position={wall.center} rotation={[0, wall.rotationY, 0]}>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color={variant.palette.wall} roughness={0.68} />
        </mesh>
      ))}

      {scene.openings.map((opening) => (
        <mesh key={opening.id} position={opening.center} rotation={[0, opening.rotationY, 0]}>
          <boxGeometry args={opening.size} />
          <meshStandardMaterial
            color={opening.type === "door" ? variant.palette.accent : "#8ec5dc"}
            transparent
            opacity={opening.type === "door" ? 0.72 : 0.58}
            roughness={0.34}
          />
        </mesh>
      ))}

      {furniture.map((item) => (
        <ProceduralFurniture key={item.id} item={item} fallbackColor={variant.palette.textile} accentColor={variant.palette.accent} />
      ))}

      {showRoomLabels
        ? scene.roomLabels.map((room) => (
            <Html key={room.id} position={room.position} transform occlude>
              <div className="room-label">
                <strong>{room.label}</strong>
                {room.areaM2 ? <span>{room.areaM2.toFixed(1)}m2</span> : null}
              </div>
            </Html>
          ))
        : null}
    </group>
  );
}

function ProceduralFurniture({
  item,
  fallbackColor,
  accentColor
}: {
  item: FurnitureItem;
  fallbackColor: string;
  accentColor: string;
}) {
  const color = item.color ?? fallbackColor;
  const position: [number, number, number] = [item.position.x, item.position.y, item.position.z];

  return (
    <group position={position} rotation={[0, item.rotationY, 0]}>
      {renderFurniturePrimitive(item, color, accentColor)}
    </group>
  );
}

function renderFurniturePrimitive(item: FurnitureItem, color: string, accentColor: string) {
  const [width, height, depth] = [item.scale.x, item.scale.y, item.scale.z];

  switch (item.assetId) {
    case "bed":
      return (
        <>
          <Box size={[width, height * 0.62, depth]} position={[0, 0, 0]} color={color} />
          <Box size={[width * 0.42, height * 0.18, depth * 0.18]} position={[-width * 0.24, height * 0.38, -depth * 0.34]} color="#f8fafc" />
          <Box size={[width * 0.42, height * 0.18, depth * 0.18]} position={[width * 0.24, height * 0.38, -depth * 0.34]} color="#f8fafc" />
        </>
      );
    case "desk":
    case "table":
      return (
        <>
          <Box size={[width, height * 0.12, depth]} position={[0, height * 0.32, 0]} color={color} />
          <TableLeg x={-width * 0.42} z={-depth * 0.38} height={height * 0.64} color={accentColor} />
          <TableLeg x={width * 0.42} z={-depth * 0.38} height={height * 0.64} color={accentColor} />
          <TableLeg x={-width * 0.42} z={depth * 0.38} height={height * 0.64} color={accentColor} />
          <TableLeg x={width * 0.42} z={depth * 0.38} height={height * 0.64} color={accentColor} />
        </>
      );
    case "chair":
      return (
        <>
          <Box size={[width, height * 0.22, depth]} position={[0, 0, 0]} color={color} />
          <Box size={[width, height * 0.82, depth * 0.14]} position={[0, height * 0.34, -depth * 0.43]} color={accentColor} />
        </>
      );
    case "rug":
      return <Box size={[width, 0.035, depth]} position={[0, -height * 0.48, 0]} color={color} />;
    case "plant":
      return (
        <>
          <mesh castShadow position={[0, -height * 0.22, 0]}>
            <cylinderGeometry args={[width * 0.18, width * 0.24, height * 0.42, 18]} />
            <meshStandardMaterial color={accentColor} roughness={0.75} />
          </mesh>
          <mesh castShadow position={[0, height * 0.18, 0]}>
            <sphereGeometry args={[Math.max(width, depth) * 0.34, 18, 12]} />
            <meshStandardMaterial color="#3c7a4d" roughness={0.7} />
          </mesh>
        </>
      );
    case "sofa":
    default:
      return (
        <>
          <Box size={[width, height * 0.52, depth]} position={[0, -height * 0.12, 0]} color={color} />
          <Box size={[width, height * 0.72, depth * 0.16]} position={[0, height * 0.16, -depth * 0.42]} color={accentColor} />
          <Box size={[width * 0.1, height * 0.46, depth]} position={[-width * 0.55, -height * 0.06, 0]} color={accentColor} />
          <Box size={[width * 0.1, height * 0.46, depth]} position={[width * 0.55, -height * 0.06, 0]} color={accentColor} />
        </>
      );
  }
}

function Box({
  size,
  position,
  color
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
}) {
  return (
    <mesh castShadow receiveShadow position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  );
}

function TableLeg({ x, z, height, color }: { x: number; z: number; height: number; color: string }) {
  return <Box size={[0.06, height, 0.06]} position={[x, 0, z]} color={color} />;
}

function createCameraPresets(
  scene: ReturnType<typeof planToSceneSpec>,
): CameraPreset[] {
  const width = Math.max(scene.bounds.widthM, 3);
  const depth = Math.max(scene.bounds.depthM, 3);
  const center: [number, number, number] = [width / 2, 0.2, depth / 2];
  const living = findRoomTarget(scene, /living|dining|kitchen/i, center);
  const bedroom = findRoomTarget(scene, /bed|office|guest/i, center);

  return [
    {
      id: "overview",
      label: "Overview",
      description: "Top-down camera for reading the whole floor plan.",
      position: [width / 2, Math.max(width, depth) * 0.78, depth * 1.18],
      target: center,
    },
    {
      id: "living",
      label: "Living",
      description: "Lower camera aimed at the living and dining zone.",
      position: [
        Math.min(width - 0.8, living[0] + 2.2),
        2.2,
        Math.min(depth - 0.8, living[2] + 2.4),
      ],
      target: living,
    },
    {
      id: "bedroom",
      label: "Bedroom / office",
      description: "Camera aimed at the sleep, work, or guest zone.",
      position: [
        Math.max(0.8, bedroom[0] - 2.4),
        2.05,
        Math.min(depth - 0.6, bedroom[2] + 1.8),
      ],
      target: bedroom,
    },
    {
      id: "walkthrough",
      label: "Walkthrough",
      description: "Eye-level guided camera from the plan entrance.",
      position: [Math.max(0.9, width * 0.18), 1.55, Math.max(0.9, depth * 0.86)],
      target: [width * 0.58, 1.2, depth * 0.48],
    },
  ];
}

function findRoomTarget(
  scene: ReturnType<typeof planToSceneSpec>,
  pattern: RegExp,
  fallback: [number, number, number],
): [number, number, number] {
  const room = scene.roomLabels.find((label) => pattern.test(label.label));
  if (!room) {
    return fallback;
  }

  return [room.position[0], 1.1, room.position[2]];
}

function createBaseFurniture(plan: PlanSchema, variant: DesignVariantSchema): FurnitureItem[] {
  return plan.rooms.slice(0, 5).map((room, index) => {
    const center = room.polygon.reduce(
      (accumulator, point) => ({
        x: accumulator.x + point.x / plan.scalePxPerMeter,
        z: accumulator.z + point.y / plan.scalePxPerMeter
      }),
      { x: 0, z: 0 }
    );
    const x = center.x / room.polygon.length;
    const z = center.z / room.polygon.length;
    const assetId = room.id.includes("bed") ? "bed" : index % 3 === 0 ? "sofa" : "table";

    return {
      id: `base-${room.id}`,
      assetId,
      roomId: room.id,
      position: { x, y: assetId === "bed" ? 0.3 : 0.36, z },
      rotationY: index % 2 === 0 ? 0 : Math.PI / 2,
      scale:
        assetId === "bed"
          ? { x: 1.45, y: 0.5, z: 1.9 }
          : assetId === "sofa"
            ? { x: 1.7, y: 0.65, z: 0.82 }
            : { x: 1, y: 0.72, z: 0.72 },
      color: variant.palette.textile
    };
  });
}

function updateVariantUrl(variantName: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  url.searchParams.set("variant", variantName);
  window.history.replaceState(null, "", url);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.ok) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}
