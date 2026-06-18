import { ProjectShell } from "../../../components/project-shell";

export default async function SharePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <ProjectShell projectId={projectId} current="share">
      <div className="stage-toolbar">
        <span className="status-pill">Public view scaffold</span>
        <span>No login required</span>
      </div>
      <div className="stage-body">
        <p className="eyebrow">Share page</p>
        <h1 className="hero-title">Public concept view.</h1>
        <p className="hero-copy">
          This page is the scaffold for tokenized public reports. The implementation thread should replace
          project IDs with unguessable share tokens before deployment.
        </p>
      </div>
    </ProjectShell>
  );
}
