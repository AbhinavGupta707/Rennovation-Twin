"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileUp,
  Loader2,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import type { ApiResponse, PlanSchema } from "@renovation-twin/types";

type ProjectStatus =
  | "DRAFT"
  | "UPLOADED"
  | "PARSED"
  | "PLAN_CONFIRMED"
  | "MODEL_GENERATED"
  | "VARIANTS_GENERATED"
  | "SHARED";

type UploadData = {
  planImageUrl: string;
  imageWidth: number;
  imageHeight: number;
  previewKind: "image" | "pdf-rendered" | "pdf-fallback";
  warning?: string;
  project: {
    status: ProjectStatus;
    uploads: Array<{ fileName: string; mimeType: string; sizeBytes: number }>;
    plan: PlanSchema;
  };
};

type ParseData = {
  planProposal: PlanSchema;
  confidence: number;
  warnings: string[];
};

type UploadFloorplanPanelProps = {
  projectId: string;
  projectTitle: string;
  projectStatus: ProjectStatus;
  plan: PlanSchema;
  latestUpload?: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  };
};

export function UploadFloorplanPanel({
  projectId,
  projectTitle,
  projectStatus,
  plan,
  latestUpload,
}: UploadFloorplanPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProjectStatus>(projectStatus);
  const [upload, setUpload] = useState(latestUpload);
  const [planStats, setPlanStats] = useState({
    walls: plan.walls.length,
    rooms: plan.rooms.length,
    imageUrl: plan.image.url,
  });
  const [parseResult, setParseResult] = useState<ParseData | null>(null);
  const [busy, setBusy] = useState<"upload" | "parse" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleUpload() {
    if (!selectedFile) {
      setMessage("Choose a PNG, JPG, SVG, or PDF floor plan first.");
      return;
    }

    setBusy("upload");
    setMessage(null);

    try {
      const preview = await readPlanPreview(selectedFile);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("imageWidth", String(preview.width));
      formData.append("imageHeight", String(preview.height));

      if (preview.dataUrl) {
        formData.append("planImageDataUrl", preview.dataUrl);
        formData.append("previewKind", "pdf-rendered");
      }

      const data = await postForm<UploadData>(
        `/api/projects/${projectId}/upload-floorplan`,
        formData,
      );
      const latest = data.project.uploads[0];

      setStatus(data.project.status);
      setUpload(latest);
      setPlanStats({
        walls: data.project.plan.walls.length,
        rooms: data.project.plan.rooms.length,
        imageUrl: data.planImageUrl,
      });
      setParseResult(null);
      setMessage(
        data.warning ??
          (data.previewKind === "pdf-rendered"
            ? "PDF first page rendered. Run parser proposal, then confirm the trace."
            : "Floor plan attached. Run parser proposal, then confirm the trace."),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleParse() {
    setBusy("parse");
    setMessage(null);

    try {
      const data = await postJson<ParseData>(
        `/api/projects/${projectId}/parse-plan`,
        {},
      );
      setParseResult(data);
      setStatus("PARSED");
      setPlanStats({
        walls: data.planProposal.walls.length,
        rooms: data.planProposal.rooms.length,
        imageUrl: data.planProposal.image.url,
      });
      setMessage(
        data.confidence >= 0.8
          ? "Plan parsed with high confidence."
          : data.confidence >= 0.5
            ? "Parser proposal ready for review."
            : "Fallback parse ready for manual trace.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Parse failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="workflow-grid">
      <section className="tool-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Upload</p>
            <h1 className="section-title">Bring in the floor plan.</h1>
          </div>
          <span className="status-pill">
            {status.toLowerCase().replaceAll("_", " ")}
          </span>
        </div>

        <div className="upload-dropzone">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml,application/pdf"
            onChange={(event) => {
              setSelectedFile(event.currentTarget.files?.[0] ?? null);
              setMessage(null);
            }}
          />
          <button
            className="button button-secondary"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <FileUp size={18} aria-hidden="true" /> Choose floor plan
          </button>
          <div>
            <strong>
              {selectedFile?.name ??
                upload?.fileName ??
                "No custom file selected"}
            </strong>
            <span>
              {selectedFile
                ? `${selectedFile.type || "unknown type"} · ${formatSize(selectedFile.size)}`
                : upload
                  ? `${upload.mimeType} · ${formatSize(upload.sizeBytes)}`
                  : "PNG, JPG, SVG, or PDF"}
            </span>
          </div>
        </div>

        <div className="button-row compact-row">
          <button
            className="button button-primary"
            type="button"
            disabled={busy !== null}
            onClick={handleUpload}
          >
            {busy === "upload" ? (
              <Loader2 className="spin-icon" size={18} aria-hidden="true" />
            ) : (
              <FileUp size={18} aria-hidden="true" />
            )}
            Upload
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={busy !== null}
            onClick={handleParse}
          >
            {busy === "parse" ? (
              <Loader2 className="spin-icon" size={18} aria-hidden="true" />
            ) : (
              <WandSparkles size={18} aria-hidden="true" />
            )}
            Parse proposal
          </button>
          <Link
            className="button button-primary"
            href={`/projects/${projectId}/plan`}
          >
            Open plan editor <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        {message ? (
          <p
            className={`inline-alert ${message.includes("failed") || message.includes("Choose") ? "alert-danger" : ""}`}
          >
            {message.includes("failed") || message.includes("Choose") ? (
              <TriangleAlert size={18} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={18} aria-hidden="true" />
            )}
            {message}
          </p>
        ) : null}

        {parseResult ? (
          <div className="evidence-list" aria-label="Parse result">
            <div>
              <span>Parse confidence</span>
              <strong>{Math.round(parseResult.confidence * 100)}%</strong>
            </div>
            <div>
              <span>Detected walls</span>
              <strong>{parseResult.planProposal.walls.length}</strong>
            </div>
            <div>
              <span>Detected rooms</span>
              <strong>{parseResult.planProposal.rooms.length}</strong>
            </div>
          </div>
        ) : null}

        {parseResult?.warnings.length ? (
          <ul className="warning-list">
            {parseResult.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <aside className="tool-panel">
        <p className="eyebrow">Project</p>
        <h2 className="panel-title">{projectTitle}</h2>
        <div className="plan-preview compact-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={planStats.imageUrl} alt="" />
        </div>
        <div className="evidence-list" aria-label="Current plan stats">
          <div>
            <span>Walls</span>
            <strong>{planStats.walls}</strong>
          </div>
          <div>
            <span>Rooms</span>
            <strong>{planStats.rooms}</strong>
          </div>
          <div>
            <span>Next step</span>
            <strong>{planStats.walls >= 4 ? "Review" : "Trace"}</strong>
          </div>
        </div>
      </aside>
    </div>
  );
}

async function postForm<T>(url: string, formData: FormData): Promise<T> {
  const response = await fetch(url, { method: "POST", body: formData });
  return readApi<T>(response);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return readApi<T>(response);
}

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.ok) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}

async function readImageSize(
  file: File,
): Promise<{ width: number; height: number }> {
  if (!file.type.startsWith("image/")) {
    return { width: 980, height: 700 };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: image.naturalWidth || 980,
        height: image.naturalHeight || 700,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 980, height: 700 });
    };
    image.src = objectUrl;
  });
}

async function readPlanPreview(file: File): Promise<{
  width: number;
  height: number;
  dataUrl?: string;
}> {
  if (file.type === "application/pdf") {
    return renderPdfFirstPage(file);
  }

  return readImageSize(file);
}

async function renderPdfFirstPage(file: File): Promise<{
  width: number;
  height: number;
  dataUrl?: string;
}> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    const documentTask = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    const pdf = await documentTask.promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, Math.max(1, 1400 / baseViewport.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("Canvas rendering context unavailable.");
    }

    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;
    await pdf.destroy();

    return {
      width: canvas.width,
      height: canvas.height,
      dataUrl: canvas.toDataURL("image/png"),
    };
  } catch {
    return { width: 980, height: 700 };
  }
}

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
