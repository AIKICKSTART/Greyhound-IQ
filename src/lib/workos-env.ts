export function sanitizeWorkosClientId(value?: string) {
  return value?.replace(/^\uFEFF/, "").trim();
}

const workosClientId = sanitizeWorkosClientId(process.env.WORKOS_CLIENT_ID);
if (workosClientId) process.env.WORKOS_CLIENT_ID = workosClientId;
