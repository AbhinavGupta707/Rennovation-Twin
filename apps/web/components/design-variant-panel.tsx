"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Palette as PaletteIcon,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type {
  ApiResponse,
  DesignVariantSchema,
  Room,
} from "@renovation-twin/types";

const presets = [
  "Warm Minimal",
  "Compact Family",
  "Resale Neutral",
];

const budgetOptions = [
  { value: "lean", label: "Lean refresh" },
  { value: "balanced", label: "Balanced" },
  { value: "premium", label: "Premium" },
] as const;

const intentOptions = [
  "family living",
  "work-from-home",
  "resale uplift",
];

const householdOptions = [
  "couple",
  "family",
  "landlord",
  "hybrid worker",
];

const paletteFields = [
  { key: "wall", label: "Walls" },
  { key: "floor", label: "Floor" },
  { key: "accent", label: "Accent" },
  { key: "textile", label: "Textile" },
] as const;

const defaultPalette: DesignVariantSchema["palette"] = {
  wall: "#f7f2e8",
  floor: "#cfae7b",
  accent: "#56675b",
  textile: "#d9c7b1",
};

type GenerateVariantData = {
  variantId: string;
  variant: DesignVariantSchema;
  provider: "fireworks" | "fallback";
  warning?: string;
};

export function DesignVariantPanel({
  projectId,
  initialVariants,
  rooms,
}: {
  projectId: string;
  initialVariants: DesignVariantSchema[];
  rooms: Room[];
}) {
  const visibleInitialVariants = initialVariants.filter(isVisibleVariant);
  const [variants, setVariants] = useState(visibleInitialVariants);
  const [stylePreset, setStylePreset] = useState(
    visibleInitialVariants[0]?.name ?? presets[0]!,
  );
  const [palette, setPalette] = useState<DesignVariantSchema["palette"]>(
    visibleInitialVariants[0]?.palette ?? defaultPalette,
  );
  const [budgetLevel, setBudgetLevel] = useState<
    (typeof budgetOptions)[number]["value"]
  >("balanced");
  const [useIntent, setUseIntent] = useState(intentOptions[0]!);
  const [householdType, setHouseholdType] = useState(householdOptions[0]!);
  const [roomPriorities, setRoomPriorities] = useState<string[]>(
    rooms.slice(0, 2).map((room) => room.id),
  );
  const [prompt, setPrompt] = useState(
    "Create a renter-friendly concept that keeps circulation clear, improves storage, and feels premium in listing photos.",
  );
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<
    GenerateVariantData["provider"] | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);

  async function generateVariant() {
    setBusy(true);
    setMessage(null);

    try {
      const data = await postJson<GenerateVariantData>(
        `/api/projects/${projectId}/generate-variant`,
        {
          prompt,
          stylePreset,
          budgetLevel,
          useIntent,
          householdType,
          roomPriorities,
          palette,
        },
      );

      setVariants((current) => [
        data.variant,
        ...current.filter((variant) => variant.name !== data.variant.name),
      ].filter(isVisibleVariant));
      setPalette(data.variant.palette);
      setProvider(data.provider);
      setMessage(
        data.provider === "fallback"
          ? `Deterministic fallback returned a variant${data.warning ? ` (${data.warning})` : ""}.`
          : "Fireworks returned a structured design variant.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Variant generation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workflow-grid design-workflow">
      <section className="tool-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Design direction</p>
            <h1 className="panel-title">Choose a renovation concept.</h1>
            <p className="panel-subcopy">
              Start from a clear style, then fine-tune the brief only if needed.
            </p>
          </div>
          <span className="status-pill">{provider ?? "ready"}</span>
        </div>

        <div className="design-summary-strip" aria-label="Current brief">
          <span>{budgetOptions.find((option) => option.value === budgetLevel)?.label}</span>
          <span>{useIntent}</span>
          <span>{householdType}</span>
          <span>{roomPriorities.length} priority rooms</span>
        </div>

        <div>
          <span className="control-label">Style</span>
          <div className="segmented-control" aria-label="Style presets">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={stylePreset === preset}
                onClick={() => {
                  setStylePreset(preset);
                  const variantPalette = variants.find(
                    (variant) => variant.name === preset,
                  )?.palette;
                  if (variantPalette) {
                    setPalette(variantPalette);
                  }
                }}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="palette-editor" aria-label="Palette controls">
          <div className="palette-editor-heading">
            <PaletteIcon size={18} aria-hidden="true" />
            <span>Palette</span>
          </div>
          <div className="color-control-grid">
            {paletteFields.map((field) => (
              <label className="color-control" key={field.key}>
                <span
                  className="color-swatch"
                  style={{ backgroundColor: palette[field.key] }}
                  aria-hidden="true"
                />
                <span>
                  {field.label}
                  <small>{palette[field.key].toUpperCase()}</small>
                </span>
                <input
                  type="color"
                  value={palette[field.key]}
                  aria-label={`${field.label} color`}
                  onChange={(event) =>
                    setPalette((current) => ({
                      ...current,
                      [field.key]: event.currentTarget.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="button-row compact-row">
          <button
            className="button button-primary"
            type="button"
            disabled={busy}
            onClick={generateVariant}
          >
            {busy ? (
              <Loader2 className="spin-icon" size={18} aria-hidden="true" />
            ) : (
              <Sparkles size={18} aria-hidden="true" />
            )}
            Generate variant
          </button>
          <Link
            className="button button-secondary"
            href={`/projects/${projectId}/model?variant=${encodeURIComponent(stylePreset)}`}
          >
            Preview in 3D <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link
            className="button button-secondary"
            href={`/projects/${projectId}/report`}
          >
            Open report <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        {message ? (
          <p
            className={`inline-alert ${message.includes("failed") ? "alert-danger" : ""}`}
          >
            {message.includes("failed") ? (
              <TriangleAlert size={18} aria-hidden="true" />
            ) : (
              <Sparkles size={18} aria-hidden="true" />
            )}
            {message}
          </p>
        ) : null}

        <details className="advanced-panel">
          <summary>
            <SlidersHorizontal size={18} aria-hidden="true" />
            Fine tune brief
          </summary>
          <div className="intent-grid">
            <div>
              <span className="control-label">Budget level</span>
              <div className="segmented-control" aria-label="Budget level">
                {budgetOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={budgetLevel === option.value}
                    onClick={() => setBudgetLevel(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="control-label">Use intent</span>
              <div className="segmented-control" aria-label="Use intent">
                {intentOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={useIntent === option}
                    onClick={() => setUseIntent(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="control-label">Household</span>
              <div className="segmented-control" aria-label="Household type">
                {householdOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={householdType === option}
                    onClick={() => setHouseholdType(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <fieldset className="priority-fieldset">
            <legend>Priority rooms</legend>
            <div className="priority-list">
              {rooms.map((room) => (
                <label key={room.id}>
                  <input
                    type="checkbox"
                    checked={roomPriorities.includes(room.id)}
                    onChange={(event) => {
                      setRoomPriorities((current) =>
                        event.currentTarget.checked
                          ? [...current, room.id]
                          : current.filter((roomId) => roomId !== room.id),
                      );
                    }}
                  />
                  <span>{room.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field-block">
            <span>Brief prompt</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.currentTarget.value)}
              rows={4}
            />
          </label>
        </details>
      </section>

      <section className="variant-grid" aria-label="Design variants">
        {variants.filter(isVisibleVariant).map((variant) => (
          <article className="card variant-card" key={variant.name}>
            <div className="card-heading-row">
              <div>
                <h2>{variant.name}</h2>
                <p>{variant.style}</p>
              </div>
              <Link
                className="icon-link"
                href={`/projects/${projectId}/model?variant=${encodeURIComponent(variant.name)}`}
              >
                3D
              </Link>
            </div>
            {variant.rationale ? (
              <p className="variant-summary">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{summarizeText(variant.rationale, 145)}</span>
              </p>
            ) : null}
            <div className="palette-row" aria-label={`${variant.name} palette`}>
              <span style={{ backgroundColor: variant.palette.wall }} />
              <span style={{ backgroundColor: variant.palette.floor }} />
              <span style={{ backgroundColor: variant.palette.accent }} />
              <span style={{ backgroundColor: variant.palette.textile }} />
            </div>
            {variant.roomNotes[0] ? (
              <p className="variant-room-highlight">
                <strong>{variant.roomNotes[0].summary}</strong>
                <span>{variant.roomNotes[0].changes.slice(0, 2).join(", ")}</span>
              </p>
            ) : null}
            <details className="variant-details">
              <summary>Room notes and cautions</summary>
              <ul className="compact-list">
                {variant.roomNotes.slice(0, 4).map((note) => (
                  <li key={`${variant.name}-${note.roomId}`}>
                    <strong>{note.summary}</strong>
                    <span>{note.changes.slice(0, 2).join(", ")}</span>
                  </li>
                ))}
              </ul>
              {variant.warnings.length ? (
                <ul className="warning-list">
                  {variant.warnings.slice(0, 2).map((warning) => (
                    <li key={`${variant.name}-${warning}`}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </details>
          </article>
        ))}
      </section>
    </div>
  );
}

function isVisibleVariant(variant: DesignVariantSchema) {
  return variant.name !== "Rental Staging";
}

function summarizeText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}...`;
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
