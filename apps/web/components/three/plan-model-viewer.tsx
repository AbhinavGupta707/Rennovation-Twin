"use client";

import {
  type ElementRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, type RootState, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Html,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  RotateCcw,
  RotateCw,
  ScanSearch,
} from "lucide-react";
import type {
  ApiResponse,
  DesignVariantSchema,
  FurnitureItem,
  PlanSchema,
} from "@renovation-twin/types";
import { Events } from "@renovation-twin/events";
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

const hiddenVariantNames = new Set(["Rental Staging"]);

type ViewerProps = {
  projectId?: string;
  plan: PlanSchema;
  variants: DesignVariantSchema[];
  initialVariantName?: string;
  readOnly?: boolean;
};

type CameraPreset = {
  id: string;
  label: string;
  description: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  controls: "orbit" | "standing";
  bounds?: MovementBounds;
  roomId?: string;
};

type NavigationIntent = "forward" | "backward" | "turn-left" | "turn-right";

type NavigationCommand = {
  id: number;
  intent: NavigationIntent;
};

type WalkContext = {
  roomId?: string;
  position?: [number, number, number];
  target?: [number, number, number];
  revision: number;
};

type StandingPosition = {
  x: number;
  z: number;
};

type DoorPortal = {
  id: string;
  label: string;
  position: StandingPosition;
  roomIds: string[];
  synthetic: boolean;
};

type PortalTarget = {
  portal: DoorPortal;
  targetRoom: RoomCameraBounds;
};

export function PlanModelViewer({
  projectId,
  plan,
  variants,
  initialVariantName,
  readOnly = false,
}: ViewerProps) {
  const scene = useMemo(() => planToSceneSpec(plan), [plan]);
  const allVariants = useMemo(
    () =>
      [baseVariant, ...variants].filter(
        (variant) => !hiddenVariantNames.has(variant.name),
      ),
    [variants],
  );
  const defaultVariantName =
    allVariants.find((variant) => variant.name === initialVariantName)?.name ?? allVariants[1]?.name ?? allVariants[0]!.name;
  const roomBounds = useMemo(() => getRoomCameraBounds(plan), [plan]);
  const doorPortals = useMemo(
    () => createDoorPortals(plan, roomBounds),
    [plan, roomBounds],
  );
  const [activeVariantName, setActiveVariantName] = useState(defaultVariantName);
  const cameraPresets = useMemo(
    () => createCameraPresets(scene, plan, roomBounds),
    [scene, plan, roomBounds],
  );
  const [activeCameraPresetId, setActiveCameraPresetId] = useState("overview");
  const [walkContext, setWalkContext] = useState<WalkContext>({
    revision: 0,
  });
  const [standingPosition, setStandingPosition] =
    useState<StandingPosition | null>(null);
  const [captureState, setCaptureState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [navigationIntent, setNavigationIntent] =
    useState<NavigationIntent | null>(null);
  const [navigationCommand, setNavigationCommand] =
    useState<NavigationCommand | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const navigationCommandIdRef = useRef(0);
  const trackedViewRef = useRef(false);
  const activeVariant = allVariants.find((variant) => variant.name === activeVariantName) ?? allVariants[0]!;
  const furniture =
    activeVariant.furniture.length > 0 ? activeVariant.furniture : createBaseFurniture(plan, activeVariant);
  const baseActiveCameraPreset =
    cameraPresets.find((preset) => preset.id === activeCameraPresetId) ??
    cameraPresets[0]!;
  const activeRoom =
    baseActiveCameraPreset.controls === "standing"
      ? roomBounds.find(
          (room) =>
            room.id === (walkContext.roomId ?? baseActiveCameraPreset.roomId),
        )
      : undefined;
  const activeCameraPreset = useMemo(
    () =>
      createActiveCameraPreset(
        baseActiveCameraPreset,
        activeRoom,
        walkContext,
      ),
    [activeRoom, baseActiveCameraPreset, walkContext],
  );
  const portalTarget = useMemo(
    () =>
      findNearestPortalTarget(
        doorPortals,
        roomBounds,
        activeRoom,
        standingPosition,
      ),
    [activeRoom, doorPortals, roomBounds, standingPosition],
  );

  const selectCameraPreset = useCallback(
    (preset: CameraPreset) => {
      setActiveCameraPresetId(preset.id);
      setStandingPosition(null);
      setWalkContext((current) => ({
        roomId: preset.roomId,
        revision: current.revision + 1,
      }));
    },
    [],
  );

  useEffect(() => {
    if (!projectId || readOnly || trackedViewRef.current) {
      return;
    }

    trackedViewRef.current = true;
    void postJson<{
      event: { name: string; createdAt: string };
    }>("/api/events", {
      name: Events.WalkthroughStarted,
      projectId,
      props: {
        projectId,
        cameraPreset: activeCameraPresetId,
      },
    }).catch((error) => {
      console.warn("Walkthrough tracking failed", error);
    });
  }, [activeCameraPresetId, projectId, readOnly]);

  async function captureScreenshot() {
    if (!projectId || readOnly || !canvasRef.current) {
      return;
    }

    setCaptureState("saving");
    setCaptureMessage("Capturing the current 3D view...");

    try {
      const imageDataUrl = createCompressedCanvasSnapshot(canvasRef.current);
      const payload = await postJson<{
        screenshot: { id: string; createdAt: string };
      }>(`/api/projects/${projectId}/screenshots`, {
        imageDataUrl,
        variantName: activeVariant.name,
        cameraPreset: activeCameraPreset.label,
      }, { timeoutMs: 10_000 });

      setCaptureState("saved");
      setCaptureMessage(`Screenshot saved for report (${payload.screenshot.id}).`);
    } catch (error) {
      setCaptureState("error");
      setCaptureMessage(
        error instanceof Error ? error.message : "Could not capture screenshot.",
      );
    }
  }

  function startNavigation(intent: NavigationIntent) {
    navigationCommandIdRef.current += 1;
    setNavigationCommand({
      id: navigationCommandIdRef.current,
      intent,
    });
    setNavigationIntent(intent);
    canvasRef.current?.focus();
  }

  function stopNavigation() {
    setNavigationIntent(null);
  }

  function openPortal(target: PortalTarget) {
    const nextPosition = createDoorEntryPosition(
      target.portal,
      target.targetRoom,
    );

    setActiveCameraPresetId(`room-${target.targetRoom.id}`);
    setStandingPosition({ x: nextPosition[0], z: nextPosition[2] });
    setWalkContext((current) => ({
      roomId: target.targetRoom.id,
      position: nextPosition,
      target: [
        target.targetRoom.center.x,
        1.34,
        target.targetRoom.center.z,
      ],
      revision: current.revision + 1,
    }));
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
              title={getVariantTitle(variant)}
              onClick={() => {
                setActiveVariantName(variant.name);
                updateVariantUrl(variant.name);
              }}
            >
              {variant.name}
            </button>
          ))}
        </div>
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
              selectCameraPreset(preset);
            }}
          >
            <ScanSearch size={16} aria-hidden="true" />
            {preset.label}
          </button>
        ))}
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
          tabIndex={0}
          dpr={[1, 1.75]}
          gl={{ preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            canvasRef.current = gl.domElement;
          }}
          aria-label="Interactive 3D renovation model"
        >
          <PerspectiveCamera
            makeDefault
            position={activeCameraPreset.position}
            fov={activeCameraPreset.fov}
            near={0.08}
            far={100}
          />
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
            portals={doorPortals}
            activeRoom={activeRoom}
            rooms={roomBounds}
            activePortalTarget={portalTarget}
            onOpenPortal={openPortal}
          />
          <CameraControlsRig
            navigationCommand={navigationCommand}
            navigationIntent={navigationIntent}
            preset={activeCameraPreset}
            onPositionChange={setStandingPosition}
          />
          <Environment preset="apartment" />
        </Canvas>
        {activeCameraPreset.controls === "standing" ? (
          <RoomMovementControls
            onStart={startNavigation}
            onStop={stopNavigation}
          />
        ) : null}
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

function RoomMovementControls({
  onStart,
  onStop,
}: {
  onStart: (intent: NavigationIntent) => void;
  onStop: () => void;
}) {
  const controls = [
    {
      intent: "turn-left" as const,
      label: "Turn left",
      icon: <RotateCcw size={18} aria-hidden="true" />,
    },
    {
      intent: "forward" as const,
      label: "Move forward",
      icon: <ArrowUp size={18} aria-hidden="true" />,
    },
    {
      intent: "turn-right" as const,
      label: "Turn right",
      icon: <RotateCw size={18} aria-hidden="true" />,
    },
    {
      intent: "backward" as const,
      label: "Move back",
      icon: <ArrowDown size={18} aria-hidden="true" />,
    },
  ];

  return (
    <div className="walk-controls" aria-label="Room movement controls">
      {controls.map((control) => (
        <button
          key={control.intent}
          type="button"
          className={`walk-control-button walk-control-${control.intent}`}
          title={control.label}
          aria-label={control.label}
          onBlur={onStop}
          onClick={() => {
            onStart(control.intent);
            window.setTimeout(onStop, 90);
          }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerCancel={onStop}
          onPointerDown={(event) => {
            event.preventDefault();
            onStart(control.intent);
          }}
          onPointerLeave={onStop}
          onPointerUp={onStop}
        >
          {control.icon}
        </button>
      ))}
    </div>
  );
}

function CameraControlsRig({
  navigationCommand,
  navigationIntent,
  onPositionChange,
  preset,
}: {
  navigationCommand: NavigationCommand | null;
  navigationIntent: NavigationIntent | null;
  onPositionChange?: (position: StandingPosition) => void;
  preset: CameraPreset;
}) {
  if (preset.controls === "standing") {
    return (
      <StandingLookControls
        navigationCommand={navigationCommand}
        navigationIntent={navigationIntent}
        onPositionChange={onPositionChange}
        preset={preset}
      />
    );
  }

  return <OrbitCameraControls preset={preset} />;
}

function OrbitCameraControls({ preset }: { preset: CameraPreset }) {
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
      enablePan={false}
      minDistance={2.2}
      maxDistance={30}
      maxPolarAngle={Math.PI / 2.08}
    />
  );
}

function StandingLookControls({
  navigationCommand,
  navigationIntent,
  onPositionChange,
  preset,
}: {
  navigationCommand: NavigationCommand | null;
  navigationIntent: NavigationIntent | null;
  onPositionChange?: (position: StandingPosition) => void;
  preset: CameraPreset;
}) {
  const { camera, gl } = useThree();
  const orientationRef = useRef(getStandingOrientation(preset));
  const positionRef = useRef<[number, number, number]>(preset.position);
  const lastNavigationCommandIdRef = useRef(0);
  const pointerRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const keysRef = useRef(new Set<string>());

  const moveCamera = useCallback(
    (forwardMeters: number, rightMeters: number) => {
      if (!forwardMeters && !rightMeters) {
        return;
      }

      const orientation = orientationRef.current;
      const position = positionRef.current;
      const nextPosition = clampPositionToBounds(
        [
          position[0] +
            Math.sin(orientation.yaw) * forwardMeters +
            Math.cos(orientation.yaw) * rightMeters,
          position[1],
          position[2] +
            Math.cos(orientation.yaw) * forwardMeters -
            Math.sin(orientation.yaw) * rightMeters,
        ],
        preset.bounds,
      );

      positionRef.current = nextPosition;
      camera.position.set(...nextPosition);
      applyStandingLook(camera, nextPosition, orientation);
      onPositionChange?.({ x: nextPosition[0], z: nextPosition[2] });
    },
    [camera, onPositionChange, preset.bounds],
  );

  const turnCamera = useCallback(
    (radians: number) => {
      if (!radians) {
        return;
      }

      const nextOrientation = {
        ...orientationRef.current,
        yaw: orientationRef.current.yaw + radians,
      };

      orientationRef.current = nextOrientation;
      camera.position.set(...positionRef.current);
      applyStandingLook(camera, positionRef.current, nextOrientation);
    },
    [camera],
  );

  useEffect(() => {
    const orientation = getStandingOrientation(preset);
    const position = clampPositionToBounds(preset.position, preset.bounds);

    orientationRef.current = orientation;
    positionRef.current = position;
    camera.position.set(...position);
    applyStandingLook(camera, position, orientation);
    onPositionChange?.({ x: position[0], z: position[2] });
  }, [camera, onPositionChange, preset]);

  useEffect(() => {
    if (
      !navigationCommand ||
      navigationCommand.id === lastNavigationCommandIdRef.current
    ) {
      return;
    }

    lastNavigationCommandIdRef.current = navigationCommand.id;

    switch (navigationCommand.intent) {
      case "forward":
        moveCamera(0.34, 0);
        break;
      case "backward":
        moveCamera(-0.34, 0);
        break;
      case "turn-left":
        turnCamera(0.28);
        break;
      case "turn-right":
        turnCamera(-0.28);
        break;
    }
  }, [moveCamera, navigationCommand, turnCamera]);

  useFrame((_, delta) => {
    const keys = keysRef.current;
    const speed = 1.35;
    const turnSpeed = 1.55;
    const step = Math.min(delta, 0.05) * speed;
    const turnStep = Math.min(delta, 0.05) * turnSpeed;
    const forward =
      (keys.has("w") || keys.has("arrowup") || navigationIntent === "forward"
        ? step
        : 0) -
      (keys.has("s") || keys.has("arrowdown") || navigationIntent === "backward"
        ? step
        : 0);
    const right =
      (keys.has("d") ? step : 0) - (keys.has("a") ? step : 0);
    const turn =
      (keys.has("arrowleft") || navigationIntent === "turn-left"
        ? turnStep
        : 0) -
      (keys.has("arrowright") || navigationIntent === "turn-right"
        ? turnStep
        : 0);

    moveCamera(forward, right);
    turnCamera(turn);
  });

  useEffect(() => {
    const element = gl.domElement;

    function onPointerDown(event: PointerEvent) {
      event.preventDefault();
      element.focus();
      pointerRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      element.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      const pointer = pointerRef.current;

      if (!pointer || pointer.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const nextOrientation = {
        yaw: orientationRef.current.yaw - (event.clientX - pointer.x) * 0.004,
        pitch: clampPitch(
          orientationRef.current.pitch - (event.clientY - pointer.y) * 0.003,
        ),
      };
      orientationRef.current = nextOrientation;
      pointerRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      camera.position.set(...positionRef.current);
      applyStandingLook(camera, positionRef.current, nextOrientation);
    }

    function onPointerUp(event: PointerEvent) {
      if (pointerRef.current?.pointerId !== event.pointerId) {
        return;
      }

      pointerRef.current = null;
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      moveCamera(Math.min(Math.max(-event.deltaY * 0.003, -0.42), 0.42), 0);
    }

    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (isMovementKey(key)) {
        event.preventDefault();
        keysRef.current.add(key);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (isMovementKey(key)) {
        event.preventDefault();
        keysRef.current.delete(key);
      }
    }

    function onBlur() {
      keysRef.current.clear();
    }

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("keydown", onKeyDown);
    element.addEventListener("keyup", onKeyUp);
    element.addEventListener("blur", onBlur);

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("keydown", onKeyDown);
      element.removeEventListener("keyup", onKeyUp);
      element.removeEventListener("blur", onBlur);
    };
  }, [camera, gl, moveCamera, preset]);

  return null;
}

function getStandingOrientation(preset: CameraPreset) {
  const dx = preset.target[0] - preset.position[0];
  const dy = preset.target[1] - preset.position[1];
  const dz = preset.target[2] - preset.position[2];
  const length = Math.max(Math.hypot(dx, dy, dz), 0.001);

  return {
    yaw: Math.atan2(dx, dz),
    pitch: clampPitch(Math.asin(dy / length)),
  };
}

function applyStandingLook(
  camera: RootState["camera"],
  position: [number, number, number],
  orientation: { yaw: number; pitch: number },
) {
  const cosPitch = Math.cos(orientation.pitch);
  const direction = {
    x: Math.sin(orientation.yaw) * cosPitch,
    y: Math.sin(orientation.pitch),
    z: Math.cos(orientation.yaw) * cosPitch,
  };

  camera.lookAt(
    position[0] + direction.x,
    position[1] + direction.y,
    position[2] + direction.z,
  );
}

function clampPitch(value: number) {
  return Math.min(Math.max(value, -0.72), 0.52);
}

function isMovementKey(key: string) {
  return [
    "w",
    "a",
    "s",
    "d",
    "arrowup",
    "arrowleft",
    "arrowdown",
    "arrowright",
  ].includes(key);
}

function clampPositionToBounds(
  position: [number, number, number],
  bounds?: MovementBounds,
): [number, number, number] {
  if (!bounds) {
    return position;
  }

  return [
    Math.min(Math.max(position[0], bounds.minX), bounds.maxX),
    position[1],
    Math.min(Math.max(position[2], bounds.minZ), bounds.maxZ),
  ];
}

function PlanScene({
  scene,
  variant,
  furniture,
  portals,
  activeRoom,
  rooms,
  activePortalTarget,
  onOpenPortal,
}: {
  scene: ReturnType<typeof planToSceneSpec>;
  variant: DesignVariantSchema;
  furniture: FurnitureItem[];
  portals: DoorPortal[];
  activeRoom?: RoomCameraBounds;
  rooms: RoomCameraBounds[];
  activePortalTarget: PortalTarget | null;
  onOpenPortal: (target: PortalTarget) => void;
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
        <OpeningMarker
          key={opening.id}
          opening={opening}
        />
      ))}

      <DoorPortalMarkers
        portals={portals}
        rooms={rooms}
        activeRoom={activeRoom}
        activePortalTarget={activePortalTarget}
        onOpenPortal={onOpenPortal}
      />

      {furniture.map((item) => (
        <ProceduralFurniture key={item.id} item={item} fallbackColor={variant.palette.textile} accentColor={variant.palette.accent} />
      ))}
    </group>
  );
}

function OpeningMarker({
  opening,
}: {
  opening: ReturnType<typeof planToSceneSpec>["openings"][number];
}) {
  if (opening.type === "door") {
    return (
      <group position={opening.center} rotation={[0, opening.rotationY, 0]}>
        <mesh position={[0, -opening.size[1] / 2 + 0.035, 0]}>
          <boxGeometry args={[opening.size[0], 0.07, 0.07]} />
          <meshStandardMaterial color="#a56f43" roughness={0.5} />
        </mesh>
        <mesh position={[0, -opening.size[1] / 2 + 0.09, 0.01]}>
          <boxGeometry args={[opening.size[0] * 0.92, 0.04, 0.18]} />
          <meshStandardMaterial color="#d2a679" roughness={0.62} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh position={opening.center} rotation={[0, opening.rotationY, 0]}>
      <boxGeometry args={opening.size} />
      <meshStandardMaterial
        color="#8ec5dc"
        transparent
        opacity={0.58}
        roughness={0.34}
      />
    </mesh>
  );
}

function DoorPortalMarkers({
  portals,
  rooms,
  activeRoom,
  activePortalTarget,
  onOpenPortal,
}: {
  portals: DoorPortal[];
  rooms: RoomCameraBounds[];
  activeRoom?: RoomCameraBounds;
  activePortalTarget: PortalTarget | null;
  onOpenPortal: (target: PortalTarget) => void;
}) {
  if (!activeRoom) {
    return null;
  }

  return (
    <>
      {portals
        .map((portal) => {
          if (!portal.roomIds.includes(activeRoom.id)) {
            return null;
          }

          const targetRoomId = portal.roomIds.find(
            (roomId) => roomId !== activeRoom.id,
          );
          const targetRoom = rooms.find((room) => room.id === targetRoomId);

          if (!targetRoom) {
            return null;
          }

          const target = { portal, targetRoom };
          const isActive = activePortalTarget?.portal.id === portal.id;

          return (
            <group
              key={`${portal.id}-${targetRoom.id}`}
              position={[portal.position.x, 0.07, portal.position.z]}
            >
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenPortal(target);
                }}
                onPointerOver={(event) => {
                  event.stopPropagation();
                  document.body.style.cursor = "pointer";
                }}
                onPointerOut={() => {
                  document.body.style.cursor = "";
                }}
              >
                <ringGeometry args={[0.22, 0.34, 32]} />
                <meshStandardMaterial
                  color={portal.synthetic ? "#8ba89a" : "#b87745"}
                  transparent
                  opacity={isActive ? 0.78 : 0.38}
                  roughness={0.55}
                />
              </mesh>
              {isActive ? (
                <Html
                  position={[0, 1.18, 0]}
                  center
                  transform={false}
                  distanceFactor={8}
                >
                  <button
                    type="button"
                    className="door-hotspot"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenPortal(target);
                    }}
                  >
                    Open {targetRoom.label}
                  </button>
                </Html>
              ) : null}
            </group>
          );
        })}
    </>
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
          <Box size={[width, height * 0.34, depth * 0.64]} position={[0, -height * 0.2, depth * 0.08]} color={color} />
          <Box size={[width, height * 0.78, depth * 0.14]} position={[0, height * 0.1, -depth * 0.39]} color={accentColor} />
          <Box size={[width * 0.1, height * 0.54, depth * 0.68]} position={[-width * 0.55, -height * 0.1, depth * 0.08]} color={accentColor} />
          <Box size={[width * 0.1, height * 0.54, depth * 0.68]} position={[width * 0.55, -height * 0.1, depth * 0.08]} color={accentColor} />
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
    <mesh castShadow receiveShadow={false} position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.78} />
    </mesh>
  );
}

function TableLeg({ x, z, height, color }: { x: number; z: number; height: number; color: string }) {
  return <Box size={[0.06, height, 0.06]} position={[x, 0, z]} color={color} />;
}

function createCameraPresets(
  scene: ReturnType<typeof planToSceneSpec>,
  plan: PlanSchema,
  rooms: RoomCameraBounds[] = getRoomCameraBounds(plan),
): CameraPreset[] {
  const width = Math.max(scene.bounds.widthM, 3);
  const depth = Math.max(scene.bounds.depthM, 3);
  const planCenter = { x: width / 2, z: depth / 2 };
  const overviewTarget: [number, number, number] = [
    planCenter.x,
    0.2,
    planCenter.z,
  ];
  const wholePlan: RoomCameraBounds = {
    id: "whole-plan",
    label: "Plan",
    minX: 0,
    maxX: width,
    minZ: 0,
    maxZ: depth,
    center: planCenter,
    width,
    depth,
  };
  const roomPresets = (rooms.length ? rooms : [wholePlan]).map((room) =>
    createRoomCameraPreset({
      id: `room-${room.id}`,
      label: room.label,
      description: `Eye-level camera standing inside ${room.label}.`,
      room,
      planCenter,
    }),
  );

  return [
    {
      id: "overview",
      label: "Overview",
      description: "Top-down camera for reading the whole floor plan.",
      position: [width / 2, Math.max(width, depth) * 0.78, depth * 1.18],
      target: overviewTarget,
      fov: 56,
      controls: "orbit",
    },
    ...roomPresets,
  ];
}

type RoomCameraBounds = {
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

type MovementBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

function getRoomCameraBounds(plan: PlanSchema): RoomCameraBounds[] {
  return plan.rooms
    .map((room) => {
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
      const width = maxX - minX;
      const depth = maxZ - minZ;

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
    })
    .filter((room) => room.width > 0.2 && room.depth > 0.2);
}

function createRoomCameraPreset({
  id,
  label,
  description,
  room,
  planCenter,
}: {
  id: CameraPreset["id"];
  label: string;
  description: string;
  room: RoomCameraBounds;
  planCenter: { x: number; z: number };
}): CameraPreset {
  const inset = getRoomInset(room);
  const innerMinX = room.minX + inset;
  const innerMaxX = room.maxX - inset;
  const innerMinZ = room.minZ + inset;
  const innerMaxZ = room.maxZ - inset;
  const corners = [
    { x: innerMinX, z: innerMinZ },
    { x: innerMaxX, z: innerMinZ },
    { x: innerMinX, z: innerMaxZ },
    { x: innerMaxX, z: innerMaxZ },
  ];
  const positionPoint = corners.reduce((best, point) =>
    distanceSquared(point, planCenter) > distanceSquared(best, planCenter)
      ? point
      : best,
  );
  const oppositePoint = {
    x: positionPoint.x < room.center.x ? innerMaxX : innerMinX,
    z: positionPoint.z < room.center.z ? innerMaxZ : innerMinZ,
  };
  const targetPoint = {
    x: room.center.x * 0.42 + oppositePoint.x * 0.58,
    z: room.center.z * 0.42 + oppositePoint.z * 0.58,
  };

  return {
    id,
    label,
    description,
    position: [positionPoint.x, 1.55, positionPoint.z],
    target: [targetPoint.x, 1.32, targetPoint.z],
    fov: 64,
    controls: "standing",
    bounds: getMovementBounds(room),
    roomId: room.id,
  };
}

function createActiveCameraPreset(
  preset: CameraPreset,
  room: RoomCameraBounds | undefined,
  context: WalkContext,
): CameraPreset {
  if (preset.controls !== "standing" || !room) {
    return preset;
  }

  return {
    ...preset,
    label: room.id === preset.roomId ? preset.label : room.label,
    description:
      room.id === preset.roomId
        ? preset.description
        : `Eye-level camera standing inside ${room.label}.`,
    position: context.position ?? preset.position,
    target: context.target ?? preset.target,
    bounds: getMovementBounds(room),
    roomId: room.id,
  };
}

function getRoomInset(room: RoomCameraBounds) {
  return Math.min(Math.max(Math.min(room.width, room.depth) * 0.18, 0.45), 0.85);
}

function getMovementBounds(room: RoomCameraBounds): MovementBounds {
  const inset = Math.min(
    Math.max(Math.min(room.width, room.depth) * 0.08, 0.2),
    0.45,
  );

  if (
    room.minX + inset > room.maxX - inset ||
    room.minZ + inset > room.maxZ - inset
  ) {
    return {
      minX: room.center.x,
      maxX: room.center.x,
      minZ: room.center.z,
      maxZ: room.center.z,
    };
  }

  return {
    minX: room.minX + inset,
    maxX: room.maxX - inset,
    minZ: room.minZ + inset,
    maxZ: room.maxZ - inset,
  };
}

function createDoorPortals(
  plan: PlanSchema,
  rooms: RoomCameraBounds[],
): DoorPortal[] {
  const wallById = new Map(plan.walls.map((wall) => [wall.id, wall]));
  const realDoorPortals = plan.openings.flatMap((opening): DoorPortal[] => {
    if (opening.type !== "door") {
      return [];
    }

    const wall = wallById.get(opening.wallId);

    if (!wall) {
      return [];
    }

    const position = getOpeningWallPosition(opening, wall, plan.scalePxPerMeter);
    const roomIds = rooms
      .filter((room) => isPositionNearRoom(position, room, 0.28))
      .map((room) => room.id);

    return roomIds.length >= 2
      ? [
          {
            id: opening.id,
            label: "Door",
            position,
            roomIds,
            synthetic: false,
          },
        ]
      : [];
  });

  return [
    ...realDoorPortals,
    ...createSyntheticRoomPortals(rooms, new Set(realDoorPortals.map((portal) => portal.id))),
  ];
}

function createSyntheticRoomPortals(
  rooms: RoomCameraBounds[],
  existingPortalIds: Set<string>,
): DoorPortal[] {
  const portals: DoorPortal[] = [];

  for (let leftIndex = 0; leftIndex < rooms.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < rooms.length;
      rightIndex += 1
    ) {
      const left = rooms[leftIndex]!;
      const right = rooms[rightIndex]!;
      const portal = createAdjacentRoomPortal(left, right);

      if (!portal || existingPortalIds.has(portal.id)) {
        continue;
      }

      portals.push(portal);
      existingPortalIds.add(portal.id);
    }
  }

  return portals;
}

function createAdjacentRoomPortal(
  left: RoomCameraBounds,
  right: RoomCameraBounds,
): DoorPortal | null {
  const tolerance = 0.08;
  const verticalTouch =
    Math.abs(left.maxX - right.minX) <= tolerance ||
    Math.abs(right.maxX - left.minX) <= tolerance;

  if (verticalTouch) {
    const sharedX =
      Math.abs(left.maxX - right.minX) <= tolerance ? left.maxX : right.maxX;
    const overlapMin = Math.max(left.minZ, right.minZ);
    const overlapMax = Math.min(left.maxZ, right.maxZ);

    if (overlapMax - overlapMin >= 0.85) {
      return {
        id: `passage-${left.id}-${right.id}`,
        label: "Passage",
        position: { x: sharedX, z: (overlapMin + overlapMax) / 2 },
        roomIds: [left.id, right.id],
        synthetic: true,
      };
    }
  }

  const horizontalTouch =
    Math.abs(left.maxZ - right.minZ) <= tolerance ||
    Math.abs(right.maxZ - left.minZ) <= tolerance;

  if (horizontalTouch) {
    const sharedZ =
      Math.abs(left.maxZ - right.minZ) <= tolerance ? left.maxZ : right.maxZ;
    const overlapMin = Math.max(left.minX, right.minX);
    const overlapMax = Math.min(left.maxX, right.maxX);

    if (overlapMax - overlapMin >= 0.85) {
      return {
        id: `passage-${left.id}-${right.id}`,
        label: "Passage",
        position: { x: (overlapMin + overlapMax) / 2, z: sharedZ },
        roomIds: [left.id, right.id],
        synthetic: true,
      };
    }
  }

  return null;
}

function getOpeningWallPosition(
  opening: PlanSchema["openings"][number],
  wall: PlanSchema["walls"][number],
  scalePxPerMeter: number,
): StandingPosition {
  const start = {
    x: wall.start.x / scalePxPerMeter,
    z: wall.start.y / scalePxPerMeter,
  };
  const end = {
    x: wall.end.x / scalePxPerMeter,
    z: wall.end.y / scalePxPerMeter,
  };
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.max(Math.hypot(dx, dz), 0.001);
  const offset = Math.min(Math.max(opening.offsetM, 0), length);

  return {
    x: start.x + (dx / length) * offset,
    z: start.z + (dz / length) * offset,
  };
}

function isPositionNearRoom(
  position: StandingPosition,
  room: RoomCameraBounds,
  tolerance: number,
) {
  return (
    position.x >= room.minX - tolerance &&
    position.x <= room.maxX + tolerance &&
    position.z >= room.minZ - tolerance &&
    position.z <= room.maxZ + tolerance
  );
}

function findNearestPortalTarget(
  portals: DoorPortal[],
  rooms: RoomCameraBounds[],
  currentRoom: RoomCameraBounds | undefined,
  position: StandingPosition | null,
): { portal: DoorPortal; targetRoom: RoomCameraBounds } | null {
  if (!currentRoom || !position) {
    return null;
  }

  const nearest = portals
    .filter((portal) => portal.roomIds.includes(currentRoom.id))
    .map((portal) => {
      const targetRoomId = portal.roomIds.find(
        (roomId) => roomId !== currentRoom.id,
      );
      const targetRoom = rooms.find((room) => room.id === targetRoomId);
      const distance = Math.hypot(
        portal.position.x - position.x,
        portal.position.z - position.z,
      );

      return targetRoom ? { portal, targetRoom, distance } : null;
    })
    .filter((candidate): candidate is {
      portal: DoorPortal;
      targetRoom: RoomCameraBounds;
      distance: number;
    } => Boolean(candidate))
    .sort((left, right) => left.distance - right.distance)[0];

  if (!nearest || nearest.distance > (nearest.portal.synthetic ? 0.8 : 1.15)) {
    return null;
  }

  return {
    portal: nearest.portal,
    targetRoom: nearest.targetRoom,
  };
}

function createDoorEntryPosition(
  portal: DoorPortal,
  targetRoom: RoomCameraBounds,
): [number, number, number] {
  const dx = targetRoom.center.x - portal.position.x;
  const dz = targetRoom.center.z - portal.position.z;
  const length = Math.max(Math.hypot(dx, dz), 0.001);
  const step = portal.synthetic ? 0.45 : 0.65;
  const position: [number, number, number] = [
    portal.position.x + (dx / length) * step,
    1.55,
    portal.position.z + (dz / length) * step,
  ];

  return clampPositionToBounds(position, getMovementBounds(targetRoom));
}

function distanceSquared(
  left: { x: number; z: number },
  right: { x: number; z: number },
) {
  return (left.x - right.x) ** 2 + (left.z - right.z) ** 2;
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

function createCompressedCanvasSnapshot(canvas: HTMLCanvasElement): string {
  const maxSidePx = 960;
  const scale = Math.min(1, maxSidePx / Math.max(canvas.width, canvas.height));
  const outputWidth = Math.max(1, Math.round(canvas.width * scale));
  const outputHeight = Math.max(1, Math.round(canvas.height * scale));
  const quality = 0.58;

  if (scale >= 0.98) {
    return canvas.toDataURL("image/jpeg", quality);
  }

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;

  const context = outputCanvas.getContext("2d");

  if (!context) {
    return canvas.toDataURL("image/jpeg", quality);
  }

  context.drawImage(canvas, 0, 0, outputWidth, outputHeight);
  return outputCanvas.toDataURL("image/jpeg", quality);
}

async function postJson<T>(
  url: string,
  body: unknown,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const controller =
    options.timeoutMs && typeof AbortController !== "undefined"
      ? new AbortController()
      : null;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), options.timeoutMs)
    : undefined;
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Saving took too long. Try capturing the view again.");
    }

    throw error;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }

  const text = await response.text();
  let payload: ApiResponse<T>;

  try {
    payload = JSON.parse(text) as ApiResponse<T>;
  } catch {
    if (!response.ok) {
      throw new Error(
        response.status === 413
          ? "Screenshot is too large for this deployment. Try a closer crop or lower browser zoom."
          : `Request failed with status ${response.status}.`,
      );
    }

    throw new Error("The server returned an empty response.");
  }

  if (!payload.ok) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}

function getVariantTitle(variant: DesignVariantSchema) {
  if (variant.name === "Survey Base") {
    return "Unstyled plan geometry generated from the floor plan.";
  }

  return `${variant.style || variant.name} design variant.`;
}
