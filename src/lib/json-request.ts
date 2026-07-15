export const JSON_REQUEST_MAX_BYTES = 64 * 1024;
export const JSON_REQUEST_MAX_ARRAY_ITEMS = 1_000;
export const JSON_REQUEST_MAX_DEPTH = 32;

export async function readBoundedJsonRequest(
  request: Request,
  maxBytes = JSON_REQUEST_MAX_BYTES,
): Promise<unknown> {
  const contentType = request.headers.get("content-type");
  if (!isJsonContentType(contentType)) {
    throw new Error("request.unsupported_media_type");
  }
  assertUtf8Charset(contentType);
  assertIdentityContentEncoding(request);

  const text = decodeUtf8(await readBoundedRequestBytes(request, maxBytes));

  try {
    const value = JSON.parse(text) as unknown;
    assertJsonShape(value);
    return value;
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
  assertUtf8Charset(request.headers.get("content-type"));
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

function assertUtf8Charset(contentType: string | null) {
  const charsets = (contentType?.split(";").slice(1) ?? []).flatMap(
    (parameter) => {
      const name = parameter.split("=", 1)[0].trim().toLowerCase();
      if (name !== "charset") return [];
      const match = /^charset\s*=\s*(?:"([^"]*)"|([^"\s]+))\s*$/i.exec(
        parameter.trim(),
      );
      return match ? [(match[1] ?? match[2]).toLowerCase()] : [""];
    },
  );
  if (
    charsets.length > 1 ||
    (charsets.length === 1 && charsets[0] !== "utf-8")
  ) {
    throw new Error("request.unsupported_media_type");
  }
}

function assertJsonShape(value: unknown) {
  const pending = [{ value, depth: 1 }];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || current.value === null || typeof current.value !== "object") {
      continue;
    }
    if (current.depth > JSON_REQUEST_MAX_DEPTH) {
      throw new Error("request.invalid_body");
    }
    if (
      Array.isArray(current.value) &&
      current.value.length > JSON_REQUEST_MAX_ARRAY_ITEMS
    ) {
      throw new Error("request.invalid_body");
    }
    for (const child of Object.values(current.value)) {
      if (child !== null && typeof child === "object") {
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  }
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
