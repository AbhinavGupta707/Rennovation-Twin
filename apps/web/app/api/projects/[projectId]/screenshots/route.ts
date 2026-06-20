import { saveProjectScreenshot } from "../../../../../lib/server/project-store";
import { jsonFail, jsonOk } from "../../../../../lib/server/api-response";

const MAX_SCREENSHOT_BYTES = 5_000_000;
const VALID_SCREENSHOT_PREFIXES = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
];

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    imageDataUrl?: string;
    variantName?: string;
    cameraPreset?: string;
  } | null;

  if (
    !body?.imageDataUrl ||
    !VALID_SCREENSHOT_PREFIXES.some((prefix) =>
      body.imageDataUrl!.startsWith(prefix),
    )
  ) {
    return jsonFail(
      "invalid_screenshot",
      "Screenshot must be an image data URL captured from the 3D canvas.",
      422,
    );
  }

  if (body.imageDataUrl.length > MAX_SCREENSHOT_BYTES) {
    return jsonFail(
      "screenshot_too_large",
      "Screenshot is too large to store in the local report cache.",
      413,
    );
  }

  const screenshot = await saveProjectScreenshot(projectId, {
    kind: "MODEL_VIEW",
    imageDataUrl: body.imageDataUrl,
    variantName: body.variantName?.slice(0, 80),
    cameraPreset: body.cameraPreset?.slice(0, 80),
  });

  return jsonOk({ screenshot });
}
