import { attachUpload } from "../../../../../lib/server/project-store";
import { jsonFail, jsonOk } from "../../../../../lib/server/api-response";

const fallbackImageUrl = "/demo/floorplans/london-flat.svg";
const supportedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "application/pdf",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonFail(
      "missing_file",
      "Upload a PNG, JPG, or PDF floor plan.",
      400,
    );
  }

  if (!supportedTypes.has(file.type)) {
    return jsonFail(
      "unsupported_file_type",
      "Supported formats are PNG, JPG, and PDF.",
      415,
    );
  }

  const imageWidth = Number(formData.get("imageWidth")) || 980;
  const imageHeight = Number(formData.get("imageHeight")) || 700;
  const planImageUrl = await fileToPreviewUrl(file);
  const project = attachUpload(projectId, {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    planImageUrl,
    imageWidth,
    imageHeight,
    createdAt: new Date().toISOString(),
  });

  return jsonOk({
    fileUrl: planImageUrl,
    planImageUrl,
    imageWidth,
    imageHeight,
    project,
  });
}

async function fileToPreviewUrl(file: File): Promise<string> {
  if (file.type === "application/pdf") {
    return fallbackImageUrl;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}
