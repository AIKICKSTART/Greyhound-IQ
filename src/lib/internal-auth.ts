import { timingSafeEqual } from "crypto";

const INTERNAL_SECRET_HEADER = "x-internal-secret";

export function requireInternalRequest(request: Request) {
  const expected =
    process.env.INTERNAL_API_SECRET ??
    process.env.INTERNAL_SECRET ??
    process.env.CRON_SECRET;
  if (!expected) throw new Error("internal.not_configured");

  const received = request.headers.get(INTERNAL_SECRET_HEADER);
  if (!received || !safeEqual(received, expected)) {
    throw new Error("auth.forbidden");
  }
}

function safeEqual(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
