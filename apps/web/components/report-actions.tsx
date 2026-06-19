"use client";

import { useState } from "react";
import { Download, Loader2, Printer, Share2 } from "lucide-react";
import type { ApiResponse } from "@renovation-twin/types";

type ReportExportData = {
  reportId: string;
  exportedAt: string;
};

type ShareData = {
  shareToken: string;
  shareUrl: string;
};

export function ReportActions({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState<"report" | "share" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function exportReport() {
    setBusy("report");
    setMessage(null);

    try {
      const data = await postJson<ReportExportData>(
        `/api/projects/${projectId}/report`,
        {},
      );
      setMessage(
        `Report export recorded at ${new Date(data.exportedAt).toLocaleTimeString()}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Report export failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function createShareLink() {
    setBusy("share");
    setMessage(null);

    try {
      const data = await postJson<ShareData>(
        `/api/projects/${projectId}/share`,
        {},
      );
      setShareUrl(`/share/${data.shareToken}`);
      setMessage("Share view is ready.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Share creation failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="tool-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Report actions</p>
          <h2 className="panel-title">Create evidence for the handoff.</h2>
        </div>
      </div>
      <div className="button-row compact-row">
        <button
          className="button button-secondary"
          type="button"
          disabled={busy !== null}
          onClick={exportReport}
        >
          {busy === "report" ? (
            <Loader2 className="spin-icon" size={18} aria-hidden="true" />
          ) : (
            <Download size={18} aria-hidden="true" />
          )}
          Record report export
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={busy !== null}
          onClick={() => window.print()}
        >
          <Printer size={18} aria-hidden="true" />
          Print
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={busy !== null}
          onClick={createShareLink}
        >
          {busy === "share" ? (
            <Loader2 className="spin-icon" size={18} aria-hidden="true" />
          ) : (
            <Share2 size={18} aria-hidden="true" />
          )}
          Create share view
        </button>
      </div>
      {shareUrl ? (
        <a className="share-url" href={shareUrl}>
          {shareUrl}
        </a>
      ) : null}
      {message ? <p className="inline-alert">{message}</p> : null}
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
