export const JSON_REQUEST_MAX_BYTES = 64 * 1024;

export async function readBoundedJsonRequest(
  request: Request,
  maxBytes = JSON_REQUEST_MAX_BYTES,
): Promise<unknown> {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    throw new Error("request.unsupported_media_type");
  }
  assertIdentityContentEncoding(request);

  const text = decodeUtf8(await readBoundedRequestBytes(request, maxBytes));

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("request.invalid_body");
  }
}

export function readBoundedOptionalJsonRequest(
  request: Request,
  maxBytes = JSON_REQUEST_MAX_BYTES,
): Promise<unknown> {
  if (request.body === null || request.headers.get("content-length") === "0") {
    return Promise.resolve({});
  }
  return readBoundedJsonRequest(request, maxBytes);
}

export async function readBoundedJsonOrFormRequest(
  request: Request,
  maxBytes = JSON_REQUEST_MAX_BYTES,
): Promise<unknown> {
  const mediaType = requestMediaType(request.headers.get("content-type"));
  if (mediaType === "application/json" || mediaType.endsWith("+json")) {
    return readBoundedJsonRequest(request, maxBytes);
  }
  if (mediaType !== "application/x-www-form-urlencoded") {
    throw new Error("request.unsupported_media_type");
  }
  assertIdentityContentEncoding(request);
  return Object.fromEntries(
    new URLSearchParams(
      decodeUtf8(await readBoundedRequestBytes(request, maxBytes)),
    ),
  );
}

async function readBoundedRequestBytes(request: Request, maxBytes: number) {
  const declaredBytes = parseContentLength(
    request.headers.get("content-length"),
  );
  if (declaredBytes === "invalid") throw new Error("request.invalid_body");
  if (declaredBytes !== null && declaredBytes > maxBytes) {
    throw new Error("request.body_too_large");
  }
  return readBoundedBody(request.body, maxBytes);
}

async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
) {
  if (!body) throw new Error("request.invalid_body");

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("request.body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

function isJsonContentType(value: string | null) {
  const mediaType = requestMediaType(value);
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

function requestMediaType(value: string | null) {
  return value?.split(";", 1)[0].trim().toLowerCase() ?? "";
}

function assertIdentityContentEncoding(request: Request) {
  const encoding = request.headers
    .get("content-encoding")
    ?.trim()
    .toLowerCase();
  if (encoding && encoding !== "identity") {
    throw new Error("request.unsupported_content_encoding");
  }
}

function decodeUtf8(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("request.invalid_body");
  }
}

function parseContentLength(value: string | null): number | null | "invalid" {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) return "invalid";
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : "invalid";
}
