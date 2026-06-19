import { attachUpload } from "../../../../../lib/server/project-store";
import { jsonFail, jsonOk } from "../../../../../lib/server/api-response";

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
  const preview = await fileToPreview(file, imageWidth, imageHeight);
  const project = await attachUpload(projectId, {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    planImageUrl: preview.url,
    imageWidth: preview.width,
    imageHeight: preview.height,
    createdAt: new Date().toISOString(),
  });

  return jsonOk({
    fileUrl: preview.url,
    planImageUrl: preview.url,
    imageWidth: preview.width,
    imageHeight: preview.height,
    previewKind: preview.kind,
    warning: preview.warning,
    project,
  });
}

async function fileToPreview(
  file: File,
  imageWidth: number,
  imageHeight: number,
): Promise<{
  url: string;
  width: number;
  height: number;
  kind: "image" | "pdf-fallback";
  warning?: string;
}> {
  if (file.type === "application/pdf") {
    return {
      url: createPdfFallbackPreview(file.name, imageWidth, imageHeight),
      width: imageWidth,
      height: imageHeight,
      kind: "pdf-fallback",
      warning:
        "PDF first-page rendering is not available in this environment yet. A traceable placeholder was created so manual correction can continue.",
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    url: `data:${file.type};base64,${bytes.toString("base64")}`,
    width: imageWidth,
    height: imageHeight,
    kind: "image",
  };
}

function createPdfFallbackPreview(
  fileName: string,
  imageWidth: number,
  imageHeight: number,
) {
  const safeName = escapeXml(fileName).slice(0, 92);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}">
      <rect width="100%" height="100%" fill="#fbfcfa"/>
      <rect x="48" y="48" width="${imageWidth - 96}" height="${imageHeight - 96}" rx="12" fill="#ffffff" stroke="#d7dfd7" stroke-width="3" stroke-dasharray="14 10"/>
      <text x="72" y="112" fill="#14201c" font-family="Arial, sans-serif" font-size="32" font-weight="700">PDF preview fallback</text>
      <text x="72" y="158" fill="#66736e" font-family="Arial, sans-serif" font-size="22">${safeName}</text>
      <text x="72" y="206" fill="#0f4ea8" font-family="Arial, sans-serif" font-size="20" font-weight="700">Trace walls manually or upload a PNG/JPG for image preview.</text>
      <path d="M120 300H${imageWidth - 120}V${imageHeight - 150}H120Z" fill="none" stroke="#14201c" stroke-width="10"/>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
