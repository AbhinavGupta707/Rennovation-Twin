import { getProjectByShareToken } from "../../../../lib/server/project-store";
import { jsonFail, jsonOk } from "../../../../lib/server/api-response";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const project = getProjectByShareToken(token);

  if (!project) {
    return jsonFail(
      "share_not_found",
      "This share link is missing or expired.",
      404,
    );
  }

  return jsonOk({ project });
}
