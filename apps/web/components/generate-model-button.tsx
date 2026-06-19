"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Cuboid, Loader2 } from "lucide-react";

export function GenerateModelButton({
  href,
  label = "Generate 3D",
}: {
  href: string;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpening, setIsOpening] = useState(false);
  const active = isOpening || isPending;

  function openModel() {
    if (active) {
      return;
    }

    setIsOpening(true);
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <>
      <button
        className="button button-primary"
        type="button"
        disabled={active}
        aria-busy={active}
        onClick={openModel}
      >
        {active ? (
          <Loader2 className="spin-icon" size={18} aria-hidden="true" />
        ) : (
          <Cuboid size={18} aria-hidden="true" />
        )}
        {active ? "Building 3D model..." : label}
      </button>
      {active ? (
        <div className="route-transition-overlay" role="status" aria-live="polite">
          <div className="route-transition-panel">
            <Loader2 className="spin-icon" size={28} aria-hidden="true" />
            <strong>Building the 3D walkthrough</strong>
            <span>Extruding walls, placing openings, and preparing the camera.</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
