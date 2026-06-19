"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import type { ApiResponse, DesignVariantSchema } from "@renovation-twin/types";

const presets = [
  "Warm Minimal",
  "Rental Staging",
  "Compact Family",
  "Resale Neutral",
];

type GenerateVariantData = {
  variantId: string;
  variant: DesignVariantSchema;
  provider: "fireworks" | "fallback";
  warning?: string;
};

export function DesignVariantPanel({
  projectId,
  initialVariants,
}: {
  projectId: string;
  initialVariants: DesignVariantSchema[];
}) {
  const [variants, setVariants] = useState(initialVariants);
  const [stylePreset, setStylePreset] = useState(
    initialVariants[0]?.name ?? presets[0]!,
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
        },
      );

      setVariants((current) => [
        data.variant,
        ...current.filter((variant) => variant.name !== data.variant.name),
      ]);
      setProvider(data.provider);
      setMessage(
        data.provider === "fallback"
          ? (data.warning ?? "Deterministic fallback returned a variant.")
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
    <div className="workflow-grid">
      <section className="tool-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">AI design variants</p>
            <h1 className="section-title">Pick and generate a direction.</h1>
          </div>
          <span className="status-pill">{provider ?? "ready"}</span>
        </div>

        <div className="segmented-control" aria-label="Style presets">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={stylePreset === preset}
              onClick={() => setStylePreset(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <label className="field-block">
          <span>Variant prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.currentTarget.value)}
            rows={5}
          />
        </label>

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
            className="button button-primary"
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
      </section>

      <section className="variant-grid" aria-label="Design variants">
        {variants.map((variant) => (
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
            <div className="palette-row" aria-label={`${variant.name} palette`}>
              <span style={{ backgroundColor: variant.palette.wall }} />
              <span style={{ backgroundColor: variant.palette.floor }} />
              <span style={{ backgroundColor: variant.palette.accent }} />
              <span style={{ backgroundColor: variant.palette.textile }} />
            </div>
            <ul className="compact-list">
              {variant.roomNotes.slice(0, 3).map((note) => (
                <li key={`${variant.name}-${note.roomId}`}>
                  <strong>{note.summary}</strong>
                  <span>{note.changes.slice(0, 2).join(", ")}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
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
