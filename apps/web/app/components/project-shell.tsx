import Link from "next/link";

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
  children: React.ReactNode;
}) {
  return (
    <section className="page-band">
      <div className="container workflow">
        <aside className="sidebar" aria-label="Project workflow">
          {steps.map(([label, step]) => (
            <Link
              key={step}
              href={`/projects/${projectId}/${step}`}
              aria-current={current === step ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </aside>
        <div className="stage">{children}</div>
      </div>
    </section>
  );
}
