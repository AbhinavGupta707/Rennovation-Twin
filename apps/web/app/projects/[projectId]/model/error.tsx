"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, RotateCcw, TriangleAlert } from "lucide-react";

export default function ModelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  useEffect(() => {
    console.error("Model page failed", error);
  }, [error]);

  return (
    <section className="page-band">
      <div className="container">
        <div className="error-panel">
          <TriangleAlert size={30} aria-hidden="true" />
          <p className="eyebrow">3D model interrupted</p>
          <h1 className="section-title">The walkthrough did not finish loading.</h1>
          <p className="hero-copy small-copy">
            Your plan is still saved. Reload the model, or return to the plan
            editor and try again.
          </p>
          <div className="button-row compact-row">
            <button className="button button-primary" type="button" onClick={reset}>
              <RotateCcw size={18} aria-hidden="true" />
              Reload model
            </button>
            <Link
              className="button button-secondary"
              href={`/projects/${projectId}/plan`}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              Back to plan
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
