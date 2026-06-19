"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, MousePointer2, PencilLine, Ruler, TriangleAlert } from "lucide-react";
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from "react-konva";
import type { Opening, PlanSchema, Vec2, Wall } from "@renovation-twin/types";

type EditorMode = "select" | "draw";

type EditableWall = Wall & {
  source: "fixture" | "manual";
};

const MIN_STAGE_WIDTH = 320;
const MAX_STAGE_WIDTH = 980;
const FIXTURE_WALL_STROKE = "#153128";
const MANUAL_WALL_STROKE = "#1967d2";
const SELECTED_WALL_STROKE = "#b87745";

function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(MAX_STAGE_WIDTH);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(MIN_STAGE_WIDTH, Math.min(MAX_STAGE_WIDTH, entry.contentRect.width));
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
    (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }),
    { x: 0, y: 0 }
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
    start: { x: wall.start.x + ux * startOffset, y: wall.start.y + uy * startOffset },
    end: { x: wall.start.x + ux * endOffset, y: wall.start.y + uy * endOffset },
    center: { x: wall.start.x + ux * ((startOffset + endOffset) / 2), y: wall.start.y + uy * ((startOffset + endOffset) / 2) }
  };
}

function newManualWall(start: Vec2, end: Vec2, index: number): EditableWall {
  return {
    id: `manual-wall-${index}`,
    source: "manual",
    start,
    end,
    thicknessM: 0.14,
    heightM: 2.6
  };
}

export function PlanEditor({ plan, projectId }: { plan: PlanSchema; projectId: string }) {
  const image = usePlanImage(plan.image.url);
  const { ref: viewportRef, width: stageWidth } = useMeasuredWidth<HTMLDivElement>();
  const [walls, setWalls] = useState<EditableWall[]>(
    plan.walls.map((wall) => ({
      ...wall,
      source: "fixture"
    }))
  );
  const [mode, setMode] = useState<EditorMode>("select");
  const [selectedWallId, setSelectedWallId] = useState(plan.walls[0]?.id ?? "");
  const [draftStart, setDraftStart] = useState<Vec2 | null>(null);
  const [draftEnd, setDraftEnd] = useState<Vec2 | null>(null);
  const [scalePxPerMeter, setScalePxPerMeter] = useState(plan.scalePxPerMeter);

  const scale = stageWidth / plan.image.widthPx;
  const stageHeight = plan.image.heightPx * scale;
  const selectedWall = walls.find((wall) => wall.id === selectedWallId);
  const manualWallCount = walls.filter((wall) => wall.source === "manual").length;
  const hasScale = scalePxPerMeter > 0;
  const hasEnoughWalls = walls.length >= 4;
  const isPlanValid = hasScale && hasEnoughWalls;
  const wallMap = useMemo(() => new Map(walls.map((wall) => [wall.id, wall])), [walls]);

  const toPlanPoint = (point: Vec2): Vec2 => ({
    x: Math.round(point.x / scale),
    y: Math.round(point.y / scale)
  });

  function setWallPoint(wallId: string, key: "start" | "end", point: Vec2) {
    setWalls((currentWalls) =>
      currentWalls.map((wall) => (wall.id === wallId ? { ...wall, [key]: point } : wall))
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="min-w-0 overflow-hidden rounded-lg border border-[rgba(20,32,28,0.14)] bg-white shadow-[0_22px_60px_rgba(42,57,49,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7dfd7] px-4 py-3">
          <div>
            <p className="m-0 text-xs font-extrabold uppercase text-[#0f4ea8]">2D plan editor</p>
            <h1 className="m-0 text-2xl font-black text-[#14201c] md:text-3xl">Confirm the London flat plan.</h1>
          </div>
          <Link
            className={`button button-primary ${isPlanValid ? "" : "pointer-events-none opacity-60"}`}
            href={`/projects/${projectId}/model`}
            aria-disabled={!isPlanValid}
          >
            Generate 3D <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-4 p-4">
          <div className="flex flex-wrap items-center gap-2" aria-label="Editor status">
            <span className="status-pill">
              <CheckCircle2 size={16} aria-hidden="true" />
              Sample fixture loaded
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
                if (mode !== "draw") {
                  return;
                }

                const stage = event.target.getStage();
                const pointer = stage?.getPointerPosition();
                if (!pointer) {
                  return;
                }

                const planPoint = toPlanPoint(pointer);
                setDraftStart(planPoint);
                setDraftEnd(planPoint);
              }}
              onPointerMove={(event) => {
                if (mode !== "draw" || !draftStart) {
                  return;
                }

                const stage = event.target.getStage();
                const pointer = stage?.getPointerPosition();
                if (pointer) {
                  setDraftEnd(toPlanPoint(pointer));
                }
              }}
              onPointerUp={() => {
                if (mode !== "draw" || !draftStart || !draftEnd) {
                  return;
                }

                const length = Math.hypot(draftEnd.x - draftStart.x, draftEnd.y - draftStart.y);
                if (length >= 16) {
                  const wall = newManualWall(draftStart, draftEnd, manualWallCount + 1);
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
                  <Rect width={plan.image.widthPx} height={plan.image.heightPx} fill="#fbfcfa" />
                  {image ? (
                    <KonvaImage image={image} width={plan.image.widthPx} height={plan.image.heightPx} opacity={0.72} />
                  ) : null}
                  {plan.rooms.map((room) => {
                    const center = polygonCenter(room.polygon);
                    return (
                      <Group key={room.id}>
                        <Line
                          points={room.polygon.flatMap((point) => [point.x, point.y])}
                          closed
                          fill="rgba(25,103,210,0.045)"
                          stroke="rgba(25,103,210,0.22)"
                          strokeWidth={2}
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
                          points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
                          stroke={
                            isSelected ? SELECTED_WALL_STROKE : wall.source === "manual" ? MANUAL_WALL_STROKE : FIXTURE_WALL_STROKE
                          }
                          strokeWidth={wall.source === "manual" ? 10 : 8}
                          lineCap="round"
                          lineJoin="round"
                          shadowColor={isSelected ? "rgba(184,119,69,0.35)" : "transparent"}
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
                              onDragMove={(event) => setWallPoint(wall.id, "start", { x: event.target.x(), y: event.target.y() })}
                            />
                            <Circle
                              x={wall.end.x}
                              y={wall.end.y}
                              radius={10}
                              fill="#ffffff"
                              stroke={SELECTED_WALL_STROKE}
                              strokeWidth={4}
                              draggable
                              onDragMove={(event) => setWallPoint(wall.id, "end", { x: event.target.x(), y: event.target.y() })}
                            />
                          </>
                        ) : null}
                      </Group>
                    );
                  })}

                  {plan.openings.map((opening) => {
                    const wall = wallMap.get(opening.wallId);
                    const segment = wall ? getOpeningSegment(opening, wall, scalePxPerMeter) : null;
                    if (!segment) {
                      return null;
                    }

                    return (
                      <Group key={opening.id}>
                        <Line
                          points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                          stroke={opening.type === "door" ? "#b87745" : "#1967d2"}
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
                      points={[draftStart.x, draftStart.y, draftEnd.x, draftEnd.y]}
                      stroke={MANUAL_WALL_STROKE}
                      strokeWidth={9}
                      dash={[12, 8]}
                      lineCap="round"
                    />
                  ) : null}

                  <Group x={80} y={660}>
                    <Line points={[0, 0, scalePxPerMeter, 0]} stroke="#0f4ea8" strokeWidth={5} lineCap="round" />
                    <Line points={[0, -10, 0, 10]} stroke="#0f4ea8" strokeWidth={4} />
                    <Line points={[scalePxPerMeter, -10, scalePxPerMeter, 10]} stroke="#0f4ea8" strokeWidth={4} />
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
          <h2 className="m-0 text-base font-black">Trace controls</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className={`button ${mode === "select" ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={() => setMode("select")}
            >
              <MousePointer2 size={18} aria-hidden="true" /> Select
            </button>
            <button
              className={`button ${mode === "draw" ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={() => {
                setMode("draw");
                setDraftStart(null);
                setDraftEnd(null);
              }}
            >
              <PencilLine size={18} aria-hidden="true" /> Draw
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            Draw mode adds a wall on release. Select mode lets you drag the highlighted wall endpoints.
          </p>
        </section>

        <section className="rounded-lg border border-[rgba(20,32,28,0.12)] bg-white p-4">
          <h2 className="m-0 flex items-center gap-2 text-base font-black">
            <Ruler size={18} aria-hidden="true" /> Scale
          </h2>
          <label className="mt-3 grid gap-2 text-sm font-bold text-[#14201c]">
            Pixels per metre
            <input
              className="min-h-11 rounded-md border border-[#d7dfd7] bg-white px-3 text-base"
              type="number"
              min="10"
              max="220"
              value={scalePxPerMeter}
              onChange={(event) => setScalePxPerMeter(Number(event.target.value))}
            />
          </label>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            The sample fixture ships with scale confirmed. Changing this value updates opening and reference-line overlays.
          </p>
        </section>

        <section className="rounded-lg border border-[rgba(20,32,28,0.12)] bg-white p-4">
          <h2 className="m-0 text-base font-black">Validation</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#66736e]">Scale state</dt>
              <dd className="m-0 font-extrabold text-[#2f7d55]">{hasScale ? "Confirmed" : "Missing"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#66736e]">Minimum walls</dt>
              <dd className="m-0 font-extrabold text-[#2f7d55]">{hasEnoughWalls ? "Ready" : "Needs 4"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#66736e]">Selected wall</dt>
              <dd className="m-0 max-w-[10rem] truncate font-extrabold">{selectedWall?.id ?? "None"}</dd>
            </div>
          </dl>
          {!isPlanValid ? (
            <p className="mt-3 flex gap-2 rounded-md bg-[rgba(180,35,24,0.08)] p-3 text-sm font-bold text-[#b42318]">
              <TriangleAlert size={18} aria-hidden="true" /> Add scale and at least four walls before generating.
            </p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
