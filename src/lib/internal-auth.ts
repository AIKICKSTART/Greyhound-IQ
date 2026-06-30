import { timingSafeEqual } from "crypto";

const INTERNAL_SECRET_HEADER = "x-internal-secret";

export function requireInternalRequest(request: Request) {
  const expectedSecrets = [
    process.env.INTERNAL_API_SECRET,
    process.env.INTERNAL_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => Boolean(value?.trim()));
  if (expectedSecrets.length === 0) throw new Error("internal.not_configured");

  const receivedSecrets = [
    request.headers.get(INTERNAL_SECRET_HEADER),
    bearerToken(request.headers.get("authorization")),
  ].filter((value): value is string => Boolean(value));

  const authorized = receivedSecrets.some((received) =>
    expectedSecrets.some((expected) => safeEqual(received, expected))
  );

  if (!authorized) {
    throw new Error("auth.forbidden");
  }
}

function bearerToken(header: string | null) {
  const prefix = "Bearer ";
  return header?.startsWith(prefix) ? header.slice(prefix.length) : null;
}

function safeEqual(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
