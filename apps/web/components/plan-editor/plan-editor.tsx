"use client";

import { useRouter } from "next/navigation";
import {
  type ComponentProps,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  DoorOpen,
  Loader2,
  Magnet,
  MousePointer2,
  PencilLine,
  Plus,
  Redo2,
  RefreshCcw,
  Ruler,
  Save,
  Tags,
  Trash2,
  TriangleAlert,
  Undo2,
  Wind,
} from "lucide-react";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from "react-konva";
import { Events } from "@renovation-twin/events";
import type {
  ApiResponse,
  Opening,
  PlanSchema,
  Room,
  Vec2,
  Wall,
} from "@renovation-twin/types";

type EditorMode = "select" | "draw" | "scale";

type EditableWall = Wall & {
  source: "fixture" | "manual";
};

type ScaleLine = {
  start: Vec2;
  end: Vec2;
};

type EditorSnapshot = {
  walls: EditableWall[];
  openings: Opening[];
  rooms: Room[];
  scalePxPerMeter: number;
  scaleLine: ScaleLine | null;
  selectedWallId: string;
  selectedRoomId: string;
};

const MIN_STAGE_WIDTH = 320;
const MAX_STAGE_WIDTH = 980;
const SNAP_DISTANCE_PX = 18;
const FIXTURE_WALL_STROKE = "#153128";
const MANUAL_WALL_STROKE = "#1967d2";
const SELECTED_WALL_STROKE = "#b87745";
const SCALE_LINE_STROKE = "#7c3aed";

function getModeGuidance(mode: EditorMode) {
  switch (mode) {
    case "draw":
      return {
        title: "Add wall mode",
        body: "Draws a blue manual wall. Saved walls are used when Generate 3D builds the model.",
      };
    case "scale":
      return {
        title: "Set scale mode",
        body: "Draws a purple reference line. Calibrating it changes the metres conversion for the full 3D model.",
      };
    case "select":
    default:
      return {
        title: "Select/edit mode",
        body: "Select walls, drag endpoints, add openings, or adjust room labels before saving.",
      };
  }
}

function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(MAX_STAGE_WIDTH);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(
        MIN_STAGE_WIDTH,
        Math.min(MAX_STAGE_WIDTH, entry.contentRect.width),
      );
      setWidth(nextWidth);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function usePlanImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const nextImage = new window.Image();
    nextImage.src = src;
    nextImage.onload = () => setImage(nextImage);
    return () => setImage(null);
  }, [src]);

  return image;
}

function polygonCenter(points: Vec2[]) {
  return points.reduce(
    (acc, point) => ({
      x: acc.x + point.x / points.length,
      y: acc.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

function getOpeningSegment(opening: Opening, wall: Wall, pxPerMeter: number) {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return null;
  }

  const ux = dx / length;
  const uy = dy / length;
  const startOffset = opening.offsetM * pxPerMeter;
  const endOffset = Math.min(length, startOffset + opening.widthM * pxPerMeter);

  return {
    start: {
      x: wall.start.x + ux * startOffset,
      y: wall.start.y + uy * startOffset,
    },
    end: { x: wall.start.x + ux * endOffset, y: wall.start.y + uy * endOffset },
    center: {
      x: wall.start.x + ux * ((startOffset + endOffset) / 2),
      y: wall.start.y + uy * ((startOffset + endOffset) / 2),
    },
  };
}

function newManualWall(start: Vec2, end: Vec2, index: number): EditableWall {
  return {
    id: `manual-wall-${index}`,
    source: "manual",
    start,
    end,
    thicknessM: 0.14,
    heightM: 2.6,
  };
}

function getWallSource(wall: Wall): EditableWall["source"] {
  return wall.id.startsWith("manual-wall-") ? "manual" : "fixture";
}

function getNextManualWallIndex(walls: Wall[]) {
  const manualIndexes = walls
    .map((wall) => wall.id.match(/^manual-wall-(\d+)$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  return manualIndexes.length ? Math.max(...manualIndexes) + 1 : 1;
}

function isAddedOpening(opening: Opening) {
  return /^(manual-opening|opening|door|window)-\d+$/.test(opening.id);
}

function getNextManualOpeningIndex(openings: Opening[]) {
  const indexes = openings
    .map((opening) => opening.id.match(/^(?:manual-opening|opening|door|window)-(\d+)$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  return indexes.length ? Math.max(...indexes) + 1 : 1;
}

function createEditableWalls(walls: Wall[]): EditableWall[] {
  const usedIds = new Set<string>();
  let nextManualIndex = getNextManualWallIndex(walls);

  return walls.map((wall, index) => {
    let id = wall.id;

    if (usedIds.has(id)) {
      if (id.startsWith("manual-wall-")) {
        id = `manual-wall-${nextManualIndex}`;
        nextManualIndex += 1;
      } else {
        id = `${id}-copy-${index + 1}`;
      }
    }

    usedIds.add(id);

    return {
      ...wall,
      id,
      source: getWallSource({ ...wall, id }),
    };
  });
}

function getWallBounds(
  walls: Wall[],
  imageWidth: number,
  imageHeight: number,
): { left: number; top: number; right: number; bottom: number } {
  if (!walls.length) {
    return {
      left: Math.round(imageWidth * 0.18),
      top: Math.round(imageHeight * 0.18),
      right: Math.round(imageWidth * 0.82),
      bottom: Math.round(imageHeight * 0.82),
    };
  }

  const points = walls.flatMap((wall) => [wall.start, wall.end]);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const inset = 18;

  return {
    left: Math.max(0, Math.min(...xs) + inset),
    top: Math.max(0, Math.min(...ys) + inset),
    right: Math.min(imageWidth, Math.max(...xs) - inset),
    bottom: Math.min(imageHeight, Math.max(...ys) - inset),
  };
}

export function PlanEditor({
  plan,
  projectId,
  projectTitle,
}: {
  plan: PlanSchema;
  projectId: string;
  projectTitle: string;
}) {
  const router = useRouter();
  const image = usePlanImage(plan.image.url);
  const { ref: viewportRef, width: stageWidth } =
    useMeasuredWidth<HTMLDivElement>();
  const manualEditTrackedRef = useRef(false);
  const [walls, setWalls] = useState<EditableWall[]>(() =>
    createEditableWalls(plan.walls),
  );
  const [mode, setMode] = useState<EditorMode>("select");
  const [selectedWallId, setSelectedWallId] = useState(plan.walls[0]?.id ?? "");
  const [draftStart, setDraftStart] = useState<Vec2 | null>(null);
  const [draftEnd, setDraftEnd] = useState<Vec2 | null>(null);
  const [scalePxPerMeter, setScalePxPerMeter] = useState(plan.scalePxPerMeter);
  const [scaleLine, setScaleLine] = useState<ScaleLine | null>({
    start: { x: 80, y: Math.max(80, plan.image.heightPx - 40) },
    end: {
      x: Math.min(plan.image.widthPx - 80, 80 + plan.scalePxPerMeter),
      y: Math.max(80, plan.image.heightPx - 40),
    },
  });
  const [scaleReferenceM, setScaleReferenceM] = useState(1);
  const [openings, setOpenings] = useState<Opening[]>(plan.openings);
  const [rooms, setRooms] = useState<Room[]>(plan.rooms);
  const [selectedRoomId, setSelectedRoomId] = useState(plan.rooms[0]?.id ?? "");
  const [roomDraftLabel, setRoomDraftLabel] = useState(
    plan.rooms[0]?.label ?? "Room",
  );
  const [newRoomLabel, setNewRoomLabel] = useState("Utility");
  const [history, setHistory] = useState<EditorSnapshot[]>([]);
  const [future, setFuture] = useState<EditorSnapshot[]>([]);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState(
    "Plan has not been saved in this session.",
  );

  const scale = stageWidth / plan.image.widthPx;
  const stageHeight = plan.image.heightPx * scale;
  const selectedWall = walls.find((wall) => wall.id === selectedWallId);
  const manualWallCount = walls.filter(
    (wall) => wall.source === "manual",
  ).length;
  const addedOpeningCount = openings.filter(isAddedOpening).length;
  const selectedWallIsManual = selectedWall?.source === "manual";
  const hasManualEdits = manualWallCount > 0 || addedOpeningCount > 0;
  const canResetSample = projectId === "demo-london-flat";
  const hasScale = scalePxPerMeter > 0;
  const hasEnoughWalls = walls.length >= 4;
  const isPlanValid = hasScale && hasEnoughWalls;
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const modeGuidance = getModeGuidance(mode);
  const wallMap = useMemo(
    () => new Map(walls.map((wall) => [wall.id, wall])),
    [walls],
  );

  function toPlanPoint(point: Vec2): Vec2 {
    return {
      x: Math.round(point.x / scale),
      y: Math.round(point.y / scale),
    };
  }

  function pointerToPlanPoint(
    event: Parameters<
      NonNullable<ComponentProps<typeof Stage>["onPointerDown"]>
    >[0],
  ) {
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    return pointer ? toPlanPoint(pointer) : null;
  }

  function captureSnapshot(): EditorSnapshot {
    return {
      walls,
      openings,
      rooms,
      scalePxPerMeter,
      scaleLine,
      selectedWallId,
      selectedRoomId,
    };
  }

  function commitHistory() {
    setHistory((current) => [...current.slice(-23), captureSnapshot()]);
    setFuture([]);
    setSaveState("idle");
    setSaveMessage("Plan has local edits that are not saved yet.");
  }

  function restoreSnapshot(snapshot: EditorSnapshot) {
    setWalls(snapshot.walls);
    setOpenings(snapshot.openings);
    setRooms(snapshot.rooms);
    setScalePxPerMeter(snapshot.scalePxPerMeter);
    setScaleLine(snapshot.scaleLine);
    setSelectedWallId(snapshot.selectedWallId);
    setSelectedRoomId(snapshot.selectedRoomId);
    setSaveState("idle");
    setSaveMessage("Plan has local edits that are not saved yet.");
  }

  function undo() {
    const snapshot = history.at(-1);
    if (!snapshot) {
      return;
    }

    setFuture((current) => [captureSnapshot(), ...current.slice(0, 23)]);
    setHistory((current) => current.slice(0, -1));
    restoreSnapshot(snapshot);
  }

  function redo() {
    const snapshot = future[0];
    if (!snapshot) {
      return;
    }

    setHistory((current) => [...current.slice(-23), captureSnapshot()]);
    setFuture((current) => current.slice(1));
    restoreSnapshot(snapshot);
  }

  function snapPoint(point: Vec2, start?: Vec2): Vec2 {
    const endpoints = walls.flatMap((wall) => [wall.start, wall.end]);
    const nearest = endpoints
      .map((endpoint) => ({
        endpoint,
        distance: Math.hypot(endpoint.x - point.x, endpoint.y - point.y),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearest && nearest.distance <= SNAP_DISTANCE_PX) {
      return nearest.endpoint;
    }

    if (start) {
      const dx = Math.abs(point.x - start.x);
      const dy = Math.abs(point.y - start.y);

      if (dx <= SNAP_DISTANCE_PX || dx < dy * 0.22) {
        return { x: start.x, y: point.y };
      }

      if (dy <= SNAP_DISTANCE_PX || dy < dx * 0.22) {
        return { x: point.x, y: start.y };
      }
    }

    return point;
  }

  function setWallPoint(wallId: string, key: "start" | "end", point: Vec2) {
    trackManualEditOnce();
    setWalls((currentWalls) =>
      currentWalls.map((wall) =>
        wall.id === wallId ? { ...wall, [key]: point } : wall,
      ),
    );
  }

  function buildCurrentPlan(): PlanSchema {
    return {
      ...plan,
      scalePxPerMeter,
      walls: walls.map((wall) => ({
        id: wall.id,
        start: wall.start,
        end: wall.end,
        thicknessM: wall.thicknessM,
        heightM: wall.heightM,
        roomIds: wall.roomIds,
      })),
      openings,
      rooms,
    };
  }

  function addOpening(type: Opening["type"]) {
    if (!selectedWall || !hasScale) {
      return;
    }

    const wallLengthM =
      Math.hypot(
        selectedWall.end.x - selectedWall.start.x,
        selectedWall.end.y - selectedWall.start.y,
      ) / scalePxPerMeter;
    const widthM = type === "door" ? 0.85 : 1.2;

    commitHistory();
    trackManualEditOnce();
    setOpenings((current) => [
      ...current,
      {
        id: `manual-opening-${getNextManualOpeningIndex(current)}`,
        type,
        wallId: selectedWall.id,
        offsetM: Math.max(0.12, (wallLengthM - widthM) / 2),
        widthM: Math.min(widthM, Math.max(0.35, wallLengthM - 0.24)),
        heightM: type === "door" ? 2.1 : 1.2,
        sillHeightM: type === "window" ? 0.9 : undefined,
      },
    ]);
  }

  function deleteSelectedManualWall() {
    if (!selectedWall || selectedWall.source !== "manual") {
      return;
    }

    commitHistory();
    setWalls((current) =>
      current.filter((wall) => wall.id !== selectedWall.id),
    );
    setOpenings((current) =>
      current.filter((opening) => opening.wallId !== selectedWall.id),
    );
    setSelectedWallId(
      walls.find((wall) => wall.id !== selectedWall.id)?.id ?? "",
    );
  }

  function clearManualEdits() {
    if (!hasManualEdits) {
      return;
    }

    commitHistory();
    const nextWalls = walls.filter((wall) => wall.source !== "manual");
    setWalls(nextWalls);
    setOpenings((current) =>
      current.filter((opening) => !isAddedOpening(opening)),
    );
    setSelectedWallId(nextWalls[0]?.id ?? "");
  }

  async function resetSamplePlan() {
    if (!canResetSample) {
      return;
    }

    setSaveState("saving");
    setSaveMessage("Resetting the sample plan...");

    try {
      const response = await fetch(`/api/projects/${projectId}/reset-demo`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not reset the sample plan.");
      }

      router.refresh();
      window.location.reload();
    } catch (error) {
      setSaveState("error");
      setSaveMessage(
        error instanceof Error ? error.message : "Could not reset the sample plan.",
      );
    }
  }

  function calibrateScale() {
    if (!scaleLine || scaleReferenceM <= 0) {
      return;
    }

    const lengthPx = Math.hypot(
      scaleLine.end.x - scaleLine.start.x,
      scaleLine.end.y - scaleLine.start.y,
    );
    if (lengthPx < 12) {
      return;
    }

    commitHistory();
    setScalePxPerMeter(Math.max(10, Math.round(lengthPx / scaleReferenceM)));
  }

  function addRoomLabel() {
    const bounds = getWallBounds(
      walls,
      plan.image.widthPx,
      plan.image.heightPx,
    );
    const label = newRoomLabel.trim() || `Room ${rooms.length + 1}`;
    const room: Room = {
      id: `manual-room-${rooms.length + 1}`,
      label,
      polygon: [
        { x: bounds.left, y: bounds.top },
        { x: bounds.right, y: bounds.top },
        { x: bounds.right, y: bounds.bottom },
        { x: bounds.left, y: bounds.bottom },
      ],
    };

    commitHistory();
    trackManualEditOnce();
    setRooms((current) => [...current, room]);
    setSelectedRoomId(room.id);
    setRoomDraftLabel(room.label);
    setNewRoomLabel(`Room ${rooms.length + 2}`);
  }

  function renameSelectedRoom(label: string) {
    setRoomDraftLabel(label);
    if (!selectedRoom) {
      return;
    }

    trackManualEditOnce();
    setSaveState("idle");
    setSaveMessage("Plan has local edits that are not saved yet.");
    setRooms((current) =>
      current.map((room) =>
        room.id === selectedRoom.id ? { ...room, label } : room,
      ),
    );
  }

  function trackManualEditOnce() {
    if (manualEditTrackedRef.current) {
      return;
    }

    manualEditTrackedRef.current = true;
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: Events.ManualEditStarted,
        projectId,
        props: { wallCount: walls.length },
      }),
    });
  }

  async function savePlan({ navigate }: { navigate: boolean }) {
    if (!isPlanValid || saveState === "saving") {
      return;
    }

    setSaveState("saving");
    setSaveMessage("Saving confirmed plan...");

    try {
      const response = await fetch(`/api/projects/${projectId}/plan`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: buildCurrentPlan() }),
      });
      const payload = (await response.json()) as ApiResponse<{
        planVersionId: string;
      }>;

      if (!payload.ok) {
        throw new Error(payload.error.message);
      }

      if (navigate) {
        setSaveMessage("Opening the 3D walkthrough...");
        router.push(`/projects/${projectId}/model`);
        return;
      }

      setSaveState("saved");
      setSaveMessage(`Saved ${payload.data.planVersionId}.`);
    } catch (error) {
      setSaveState("error");
      setSaveMessage(
        error instanceof Error ? error.message : "Could not save the plan.",
      );
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="min-w-0 overflow-hidden rounded-lg border border-[rgba(20,32,28,0.14)] bg-white shadow-[0_22px_60px_rgba(42,57,49,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7dfd7] px-4 py-3">
          <div>
            <p className="m-0 text-xs font-extrabold uppercase text-[#0f4ea8]">
              {projectTitle}
            </p>
            <h1 className="m-0 text-2xl font-black text-[#14201c] md:text-3xl">
              Confirm the floor plan.
            </h1>
          </div>
          <div className="grid justify-items-end gap-1">
            <button
              className="button button-primary"
              type="button"
              disabled={!isPlanValid || saveState === "saving"}
              aria-disabled={!isPlanValid}
              aria-busy={saveState === "saving"}
              onClick={() => {
                void savePlan({ navigate: true });
              }}
            >
              {saveState === "saving" ? (
                <Loader2 className="spin-icon" size={18} aria-hidden="true" />
              ) : (
                <ArrowRight size={18} aria-hidden="true" />
              )}
              {saveState === "saving" ? "Building 3D model..." : "Generate 3D"}
            </button>
            <span className="text-right text-xs font-bold text-[#66736e]">
              Saves these edits before opening the model.
            </span>
          </div>
        </div>

        <div className="grid gap-4 p-4">
          <div
            className="flex flex-wrap items-center gap-2"
            aria-label="Editor status"
          >
            <span className="status-pill">
              <CheckCircle2 size={16} aria-hidden="true" />
              Plan geometry loaded
            </span>
            <span className="inline-flex min-h-9 items-center rounded-full bg-[rgba(25,103,210,0.1)] px-3 text-sm font-extrabold text-[#0f4ea8]">
              {walls.length} walls
            </span>
            <span className="inline-flex min-h-9 items-center rounded-full bg-[rgba(184,119,69,0.13)] px-3 text-sm font-extrabold text-[#7a4b24]">
              {manualWallCount} manual
            </span>
            <span className="inline-flex min-h-9 items-center rounded-full bg-[rgba(47,125,85,0.12)] px-3 text-sm font-extrabold text-[#2f7d55]">
              Scale {scalePxPerMeter} px/m
            </span>
          </div>

          <div
            ref={viewportRef}
            className="overflow-hidden rounded-lg border border-[#d7dfd7] bg-[#fbfcfa]"
            aria-label="Interactive floor plan canvas"
          >
            <Stage
              width={stageWidth}
              height={stageHeight}
              onPointerDown={(event) => {
                if (mode !== "draw" && mode !== "scale") {
                  return;
                }

                const planPoint = pointerToPlanPoint(event);
                if (!planPoint) {
                  return;
                }

                const nextPoint =
                  mode === "draw" ? snapPoint(planPoint) : planPoint;
                setDraftStart(nextPoint);
                setDraftEnd(nextPoint);
              }}
              onPointerMove={(event) => {
                if ((mode !== "draw" && mode !== "scale") || !draftStart) {
                  return;
                }

                const planPoint = pointerToPlanPoint(event);
                if (planPoint) {
                  setDraftEnd(
                    mode === "draw"
                      ? snapPoint(planPoint, draftStart)
                      : snapPoint(planPoint, draftStart),
                  );
                }
              }}
              onPointerUp={() => {
                if (
                  (mode !== "draw" && mode !== "scale") ||
                  !draftStart ||
                  !draftEnd
                ) {
                  return;
                }

                const length = Math.hypot(
                  draftEnd.x - draftStart.x,
                  draftEnd.y - draftStart.y,
                );

                if (mode === "scale" && length >= 12) {
                  commitHistory();
                  setScaleLine({ start: draftStart, end: draftEnd });
                } else if (mode === "draw" && length >= 16) {
                  commitHistory();
                  const wall = newManualWall(
                    draftStart,
                    draftEnd,
                    getNextManualWallIndex(walls),
                  );
                  trackManualEditOnce();
                  setWalls((currentWalls) => [...currentWalls, wall]);
                  setSelectedWallId(wall.id);
                }

                setDraftStart(null);
                setDraftEnd(null);
                setMode("select");
              }}
            >
              <Layer>
                <Group scaleX={scale} scaleY={scale}>
                  <Rect
                    width={plan.image.widthPx}
                    height={plan.image.heightPx}
                    fill="#fbfcfa"
                  />
                  {image ? (
                    <KonvaImage
                      image={image}
                      width={plan.image.widthPx}
                      height={plan.image.heightPx}
                      opacity={0.72}
                    />
                  ) : null}
                  {rooms.map((room) => {
                    const center = polygonCenter(room.polygon);
                    return (
                      <Group key={room.id}>
                        <Line
                          points={room.polygon.flatMap((point) => [
                            point.x,
                            point.y,
                          ])}
                          closed
                          fill="rgba(25,103,210,0.045)"
                          stroke="rgba(25,103,210,0.22)"
                          strokeWidth={2}
                          onClick={() => {
                            setSelectedRoomId(room.id);
                            setRoomDraftLabel(room.label);
                          }}
                          onTap={() => {
                            setSelectedRoomId(room.id);
                            setRoomDraftLabel(room.label);
                          }}
                        />
                        <Rect
                          x={center.x - 58}
                          y={center.y - 17}
                          width={116}
                          height={28}
                          cornerRadius={5}
                          fill="rgba(255,255,255,0.88)"
                          stroke="rgba(20,32,28,0.12)"
                        />
                        <Text
                          x={center.x - 54}
                          y={center.y - 10}
                          width={108}
                          align="center"
                          text={room.label}
                          fontFamily="Inter, Arial, sans-serif"
                          fontSize={13}
                          fontStyle="bold"
                          fill="#14201c"
                        />
                      </Group>
                    );
                  })}

                  {walls.map((wall) => {
                    const isSelected = wall.id === selectedWallId;
                    return (
                      <Group key={wall.id}>
                        <Line
                          points={[
                            wall.start.x,
                            wall.start.y,
                            wall.end.x,
                            wall.end.y,
                          ]}
                          stroke={
                            isSelected
                              ? SELECTED_WALL_STROKE
                              : wall.source === "manual"
                                ? MANUAL_WALL_STROKE
                                : FIXTURE_WALL_STROKE
                          }
                          strokeWidth={wall.source === "manual" ? 10 : 8}
                          lineCap="round"
                          lineJoin="round"
                          shadowColor={
                            isSelected ? "rgba(184,119,69,0.35)" : "transparent"
                          }
                          shadowBlur={isSelected ? 9 : 0}
                          onClick={() => setSelectedWallId(wall.id)}
                          onTap={() => setSelectedWallId(wall.id)}
                        />
                        {isSelected ? (
                          <>
                            <Circle
                              x={wall.start.x}
                              y={wall.start.y}
                              radius={10}
                              fill="#ffffff"
                              stroke={SELECTED_WALL_STROKE}
                              strokeWidth={4}
                              draggable
                              onDragStart={() => {
                                commitHistory();
                                trackManualEditOnce();
                              }}
                              onDragMove={(event) =>
                                setWallPoint(wall.id, "start", {
                                  x: Math.round(event.target.x()),
                                  y: Math.round(event.target.y()),
                                })
                              }
                            />
                            <Circle
                              x={wall.end.x}
                              y={wall.end.y}
                              radius={10}
                              fill="#ffffff"
                              stroke={SELECTED_WALL_STROKE}
                              strokeWidth={4}
                              draggable
                              onDragStart={() => {
                                commitHistory();
                                trackManualEditOnce();
                              }}
                              onDragMove={(event) =>
                                setWallPoint(wall.id, "end", {
                                  x: Math.round(event.target.x()),
                                  y: Math.round(event.target.y()),
                                })
                              }
                            />
                          </>
                        ) : null}
                      </Group>
                    );
                  })}

                  {openings.map((opening) => {
                    const wall = wallMap.get(opening.wallId);
                    const segment = wall
                      ? getOpeningSegment(opening, wall, scalePxPerMeter)
                      : null;
                    if (!segment) {
                      return null;
                    }

                    return (
                      <Group key={opening.id}>
                        <Line
                          points={[
                            segment.start.x,
                            segment.start.y,
                            segment.end.x,
                            segment.end.y,
                          ]}
                          stroke={
                            opening.type === "door" ? "#b87745" : "#1967d2"
                          }
                          strokeWidth={14}
                          lineCap="round"
                        />
                        <Text
                          x={segment.center.x - 22}
                          y={segment.center.y - 24}
                          width={44}
                          align="center"
                          text={opening.type}
                          fontFamily="Inter, Arial, sans-serif"
                          fontSize={11}
                          fontStyle="bold"
                          fill={opening.type === "door" ? "#7a4b24" : "#0f4ea8"}
                        />
                      </Group>
                    );
                  })}

                  {draftStart && draftEnd ? (
                    <Line
                      points={[
                        draftStart.x,
                        draftStart.y,
                        draftEnd.x,
                        draftEnd.y,
                      ]}
                      stroke={
                        mode === "scale"
                          ? SCALE_LINE_STROKE
                          : MANUAL_WALL_STROKE
                      }
                      strokeWidth={mode === "scale" ? 6 : 9}
                      dash={[12, 8]}
                      lineCap="round"
                    />
                  ) : null}

                  {scaleLine ? (
                    <Group>
                      <Line
                        points={[
                          scaleLine.start.x,
                          scaleLine.start.y,
                          scaleLine.end.x,
                          scaleLine.end.y,
                        ]}
                        stroke={SCALE_LINE_STROKE}
                        strokeWidth={5}
                        lineCap="round"
                      />
                      <Circle
                        x={scaleLine.start.x}
                        y={scaleLine.start.y}
                        radius={7}
                        fill="#ffffff"
                        stroke={SCALE_LINE_STROKE}
                        strokeWidth={3}
                      />
                      <Circle
                        x={scaleLine.end.x}
                        y={scaleLine.end.y}
                        radius={7}
                        fill="#ffffff"
                        stroke={SCALE_LINE_STROKE}
                        strokeWidth={3}
                      />
                    </Group>
                  ) : null}

                  <Group x={80} y={660}>
                    <Line
                      points={[0, 0, scalePxPerMeter, 0]}
                      stroke="#0f4ea8"
                      strokeWidth={5}
                      lineCap="round"
                    />
                    <Line
                      points={[0, -10, 0, 10]}
                      stroke="#0f4ea8"
                      strokeWidth={4}
                    />
                    <Line
                      points={[scalePxPerMeter, -10, scalePxPerMeter, 10]}
                      stroke="#0f4ea8"
                      strokeWidth={4}
                    />
                    <Text
                      x={0}
                      y={14}
                      text={`1 m scale reference (${scalePxPerMeter} px/m)`}
                      fontFamily="Inter, Arial, sans-serif"
                      fontSize={14}
                      fontStyle="bold"
                      fill="#0f4ea8"
                    />
                  </Group>
                </Group>
              </Layer>
            </Stage>
          </div>
        </div>
      </section>

      <aside className="grid content-start gap-4">
        <section className="rounded-lg border border-[rgba(20,32,28,0.12)] bg-white p-4">
          <h2 className="m-0 text-base font-black">Plan tools</h2>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <button
              className={`button ${mode === "select" ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={() => setMode("select")}
            >
              <MousePointer2 size={18} aria-hidden="true" /> Edit
            </button>
            <button
              className={`button ${mode === "draw" ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={() => {
                trackManualEditOnce();
                setMode("draw");
                setDraftStart(null);
                setDraftEnd(null);
              }}
            >
              <PencilLine size={18} aria-hidden="true" /> Add wall
            </button>
            <button
              className={`button ${mode === "scale" ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={() => {
                setMode("scale");
                setDraftStart(null);
                setDraftEnd(null);
              }}
            >
              <Ruler size={18} aria-hidden="true" /> Set scale
            </button>
          </div>
          <div className="mt-3 rounded-lg border border-[#d7dfd7] bg-[#f6f8f5] p-3">
            <strong className="block text-sm text-[#14201c]">
              {modeGuidance.title}
            </strong>
            <p className="m-0 mt-1 text-sm leading-6 text-[#66736e]">
              {modeGuidance.body}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="button button-secondary"
              type="button"
              disabled={!history.length}
              onClick={undo}
            >
              <Undo2 size={18} aria-hidden="true" /> Undo
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={18} aria-hidden="true" /> Redo
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            <button
              className="button button-secondary"
              type="button"
              disabled={!selectedWallIsManual}
              onClick={deleteSelectedManualWall}
            >
              <Trash2 size={18} aria-hidden="true" /> Delete selected wall
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={!hasManualEdits}
              onClick={clearManualEdits}
            >
              <Trash2 size={18} aria-hidden="true" /> Clear added walls/windows
            </button>
            {canResetSample ? (
              <button
                className="button button-secondary"
                type="button"
                disabled={saveState === "saving"}
                onClick={() => {
                  void resetSamplePlan();
                }}
              >
                <RefreshCcw size={18} aria-hidden="true" /> Reset sample plan
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-[rgba(20,32,28,0.12)] bg-white p-4">
          <h2 className="m-0 flex items-center gap-2 text-base font-black">
            <DoorOpen size={18} aria-hidden="true" /> Openings
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            Select a wall, then add a door or window marker. Doors can become
            walkthrough prompts in the 3D model.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="button button-secondary"
              type="button"
              disabled={!selectedWall || !hasScale}
              onClick={() => addOpening("door")}
            >
              <DoorOpen size={18} aria-hidden="true" /> Door
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={!selectedWall || !hasScale}
              onClick={() => addOpening("window")}
            >
              <Wind size={18} aria-hidden="true" /> Window
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-[rgba(20,32,28,0.12)] bg-white p-4">
          <h2 className="m-0 flex items-center gap-2 text-base font-black">
            <Ruler size={18} aria-hidden="true" /> Scale
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            Scale changes the metres conversion for walls, rooms, furniture, and
            camera movement.
          </p>
          <label className="mt-3 grid gap-2 text-sm font-bold text-[#14201c]">
            Pixels per metre
            <input
              className="min-h-11 rounded-md border border-[#d7dfd7] bg-white px-3 text-base"
              type="number"
              min="10"
              max="220"
              value={scalePxPerMeter}
              onFocus={commitHistory}
              onChange={(event) => {
                const nextScale = Number(event.target.value);
                setScalePxPerMeter(Number.isFinite(nextScale) ? nextScale : 0);
              }}
            />
          </label>
          <label className="mt-3 grid gap-2 text-sm font-bold text-[#14201c]">
            Reference length in metres
            <input
              className="min-h-11 rounded-md border border-[#d7dfd7] bg-white px-3 text-base"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={scaleReferenceM}
              onChange={(event) => {
                const nextReference = Number(event.target.value);
                setScaleReferenceM(
                  Number.isFinite(nextReference) ? nextReference : 0,
                );
              }}
            />
          </label>
          <button
            className="button button-secondary mt-3 w-full"
            type="button"
            disabled={!scaleLine || scaleReferenceM <= 0}
            onClick={calibrateScale}
          >
            <Ruler size={18} aria-hidden="true" /> Calibrate from line
          </button>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            Draw a scale line over a known measurement, enter its real length,
            then calibrate.
          </p>
        </section>

        <section className="rounded-lg border border-[rgba(20,32,28,0.12)] bg-white p-4">
          <h2 className="m-0 flex items-center gap-2 text-base font-black">
            <Tags size={18} aria-hidden="true" /> Rooms
          </h2>
          <label className="mt-3 grid gap-2 text-sm font-bold text-[#14201c]">
            Selected room label
            <input
              className="min-h-11 rounded-md border border-[#d7dfd7] bg-white px-3 text-base"
              value={roomDraftLabel}
              onFocus={commitHistory}
              onChange={(event) => renameSelectedRoom(event.target.value)}
            />
          </label>
          <label className="mt-3 grid gap-2 text-sm font-bold text-[#14201c]">
            New room label
            <input
              className="min-h-11 rounded-md border border-[#d7dfd7] bg-white px-3 text-base"
              value={newRoomLabel}
              onChange={(event) => setNewRoomLabel(event.target.value)}
            />
          </label>
          <button
            className="button button-secondary mt-3 w-full"
            type="button"
            onClick={addRoomLabel}
          >
            <Plus size={18} aria-hidden="true" /> Add room label
          </button>
          <div className="mt-3 grid gap-2">
            {rooms.map((room) => (
              <button
                className={`button ${room.id === selectedRoomId ? "button-primary" : "button-secondary"} justify-start`}
                key={room.id}
                type="button"
                onClick={() => {
                  setSelectedRoomId(room.id);
                  setRoomDraftLabel(room.label);
                }}
              >
                <Tags size={18} aria-hidden="true" /> {room.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[rgba(20,32,28,0.12)] bg-white p-4">
          <h2 className="m-0 text-base font-black">Validation</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#66736e]">Scale state</dt>
              <dd className="m-0 font-extrabold text-[#2f7d55]">
                {hasScale ? "Confirmed" : "Missing"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#66736e]">Minimum walls</dt>
              <dd className="m-0 font-extrabold text-[#2f7d55]">
                {hasEnoughWalls ? "Ready" : "Needs 4"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#66736e]">Selected wall</dt>
              <dd className="m-0 max-w-[10rem] truncate font-extrabold">
                {selectedWall?.id ?? "None"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#66736e]">Openings</dt>
              <dd className="m-0 font-extrabold text-[#2f7d55]">
                {openings.length}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#66736e]">Rooms</dt>
              <dd className="m-0 font-extrabold text-[#2f7d55]">
                {rooms.length}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1 text-[#66736e]">
                <Magnet size={14} aria-hidden="true" /> Snapping
              </dt>
              <dd className="m-0 font-extrabold text-[#2f7d55]">On</dd>
            </div>
          </dl>
          {!isPlanValid ? (
            <p className="mt-3 flex gap-2 rounded-md bg-[rgba(180,35,24,0.08)] p-3 text-sm font-bold text-[#b42318]">
              <TriangleAlert size={18} aria-hidden="true" /> Add scale and at
              least four walls before generating.
            </p>
          ) : null}
          <button
            className="button button-secondary mt-4 w-full"
            type="button"
            disabled={!isPlanValid || saveState === "saving"}
            onClick={() => void savePlan({ navigate: false })}
          >
            {saveState === "saving" ? (
              <Loader2 className="spin-icon" size={18} aria-hidden="true" />
            ) : (
              <Save size={18} aria-hidden="true" />
            )}
            Save confirmed plan
          </button>
          <p
            className={`mt-3 text-sm font-bold ${saveState === "error" ? "text-[#b42318]" : "text-[#66736e]"}`}
          >
            {saveMessage}
          </p>
        </section>
      </aside>
    </div>
  );
}
