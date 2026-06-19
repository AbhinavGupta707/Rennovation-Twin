import { ProjectShell } from "../../../components/project-shell";
import { UploadFloorplanPanel } from "../../../../components/upload-floorplan-panel";
import { getProjectOrDemo } from "../../../../lib/server/project-store";

export const dynamic = "force-dynamic";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = getProjectOrDemo(projectId);
  const latestUpload = project.uploads[0];

  return (
    <ProjectShell projectId={projectId} current="upload">
      <div className="stage-toolbar">
        <span className="status-pill">Upload and parse ready</span>
        <span>PNG, JPG, SVG, PDF</span>
      </div>
      <div className="stage-body">
        <UploadFloorplanPanel
          projectId={projectId}
          projectTitle={project.title}
          projectStatus={project.status}
          plan={project.plan}
          latestUpload={latestUpload}
        />
      </div>
    </ProjectShell>
  );
}
