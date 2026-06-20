"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

const steps = [
  ["Upload", "upload"],
  ["Plan", "plan"],
  ["Model", "model"],
  ["Design", "design"],
  ["Report", "report"],
  ["Share", "share"]
] as const;

export function ProjectShell({
  projectId,
  current,
  children
}: {
  projectId: string;
  current: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [pendingStep, setPendingStep] = useState<string | null>(null);
  const pendingHref = pendingStep ? `/projects/${projectId}/${pendingStep}` : null;
  const visiblePendingStep = pendingHref === pathname ? null : pendingStep;
  const pendingLabel = steps.find(([, step]) => step === visiblePendingStep)?.[0];

  return (
    <section className="page-band">
      <div className="container workflow">
        <aside className="sidebar" aria-label="Project workflow">
          {steps.map(([label, step]) => (
            <Link
              key={step}
              href={`/projects/${projectId}/${step}`}
              aria-current={current === step ? "page" : undefined}
              aria-busy={visiblePendingStep === step ? "true" : undefined}
              onClick={() => {
                if (current !== step) {
                  setPendingStep(step);
                }
              }}
            >
              <span>{label}</span>
              {visiblePendingStep === step ? (
                <Loader2 className="spin-icon" size={15} aria-hidden="true" />
              ) : null}
            </Link>
          ))}
        </aside>
        <div className="stage">
          {pendingLabel ? (
            <div className="stage-loading" role="status">
              <Loader2 className="spin-icon" size={18} aria-hidden="true" />
              Opening {pendingLabel}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}
