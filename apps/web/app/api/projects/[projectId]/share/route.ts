import { createShare } from "../../../../../lib/server/project-store";
import { jsonOk } from "../../../../../lib/server/api-response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const { shareToken } = createShare(projectId);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || new URL(_request.url).origin;

  return jsonOk({
    shareToken,
    shareUrl: `${baseUrl}/share/${shareToken}`,
  });
}
