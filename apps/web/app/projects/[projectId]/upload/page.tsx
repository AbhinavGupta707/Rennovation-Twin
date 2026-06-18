import { ProjectShell } from "../../../components/project-shell";

export default async function UploadPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <ProjectShell projectId={projectId} current="upload">
      <div className="stage-toolbar">
        <span className="status-pill">Upload scaffold</span>
        <span>PNG, JPG, PDF</span>
      </div>
      <div className="stage-body">
        <p className="eyebrow">Upload</p>
        <h1 className="hero-title">Bring your plan.</h1>
        <div className="plan-preview">
          <p>Drag/drop implementation belongs to the upload/parser thread.</p>
        </div>
      </div>
    </ProjectShell>
  );
}
