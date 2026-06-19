"use client";

import { useState } from "react";
import { Copy, Loader2, Share2 } from "lucide-react";
import type { ApiResponse } from "@renovation-twin/types";

type ShareData = {
  shareToken: string;
  shareUrl: string;
};

export function ShareActions({
  projectId,
  initialShareToken,
}: {
  projectId: string;
  initialShareToken?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState(
    initialShareToken ? `/share/${initialShareToken}` : "",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function createShareLink() {
    setBusy(true);
    setMessage(null);

    try {
      const data = await postJson<ShareData>(
        `/api/projects/${projectId}/share`,
        {},
      );
      setShareUrl(data.shareUrl);
      setMessage("Share link created.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Share creation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) {
      return;
    }

    const copyTarget = shareUrl.startsWith("/")
      ? `${window.location.origin}${shareUrl}`
      : shareUrl;
    await navigator.clipboard.writeText(copyTarget);
    setMessage("Share link copied.");
  }

  return (
    <div className="tool-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Public view</p>
          <h1 className="section-title">Share the concept without login.</h1>
        </div>
      </div>
      <div className="button-row compact-row">
        <button
          className="button button-primary"
          type="button"
          disabled={busy}
          onClick={createShareLink}
        >
          {busy ? (
            <Loader2 className="spin-icon" size={18} aria-hidden="true" />
          ) : (
            <Share2 size={18} aria-hidden="true" />
          )}
          Create share link
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={!shareUrl}
          onClick={copyLink}
        >
          <Copy size={18} aria-hidden="true" /> Copy
        </button>
      </div>
      {shareUrl ? (
        <a className="share-url" href={shareUrl}>
          {shareUrl}
        </a>
      ) : (
        <p className="hero-copy small-copy">
          Tokenized public links are generated on demand for the current concept
          report.
        </p>
      )}
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
