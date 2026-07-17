import { handleReplayStreamGet } from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleReplayStreamGet(request);
}
