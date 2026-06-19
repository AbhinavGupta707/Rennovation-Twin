"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import type { ApiResponse } from "@renovation-twin/types";

type CreateProjectData = {
  projectId: string;
  title: string;
};

export function NewProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("Hackathon test flat");
  const [postcode, setPostcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createProject() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, postcode }),
      });
      const payload = (await response.json()) as ApiResponse<CreateProjectData>;

      if (!payload.ok) {
        throw new Error(payload.error.message);
      }

      router.push(`/projects/${payload.data.projectId}/upload`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Project creation failed.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="tool-panel">
      <p className="eyebrow">Start project</p>
      <h2 className="panel-title">Create a project shell.</h2>
      <label className="field-block">
        <span>Project name</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
      </label>
      <label className="field-block">
        <span>Postcode optional</span>
        <input
          value={postcode}
          onChange={(event) => setPostcode(event.currentTarget.value)}
        />
      </label>
      <button
        className="button button-primary"
        type="button"
        disabled={busy}
        onClick={createProject}
      >
        {busy ? (
          <Loader2 className="spin-icon" size={18} aria-hidden="true" />
        ) : (
          <ArrowRight size={18} aria-hidden="true" />
        )}
        Continue to upload
      </button>
      {message ? <p className="inline-alert alert-danger">{message}</p> : null}
    </div>
  );
}
