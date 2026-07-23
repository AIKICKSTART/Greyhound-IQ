export type BoundedTextResponsePolicy = {
  readonly maxBytes: number;
  readonly allowedContentTypes: readonly string[];
};

export async function readBoundedTextResponse(
  response: Response,
  policy: BoundedTextResponsePolicy,
) {
  if (!Number.isSafeInteger(policy.maxBytes) || policy.maxBytes <= 0) {
    throw new Error("remote_response.invalid_limit");
  }
  const contentType = response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase() ?? "";
  const allowed = policy.allowedContentTypes.some((value) => {
    const normalized = value.trim().toLowerCase();
    return normalized.startsWith("+")
      ? contentType.endsWith(normalized)
      : contentType === normalized;
  });
  if (!allowed) {
    throw new Error("remote_response.invalid_content_type");
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    (declaredLength < 0 || declaredLength > policy.maxBytes)
  ) {
    throw new Error("remote_response.too_large");
  }

  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > policy.maxBytes) {
        await reader.cancel();
        throw new Error("remote_response.too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
