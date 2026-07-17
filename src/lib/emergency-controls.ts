const DISABLED_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Retry-After": "60",
} as const;

export function isEmergencyControlActive(value: string | undefined) {
  if (value === undefined) return false;
  return value.trim().toLowerCase() !== "false";
}

export function emergencyControlResponse() {
  return Response.json(
    {
      error: {
        code: "service.temporarily_unavailable",
        message: "Temporarily unavailable",
      },
    },
    { status: 503, headers: DISABLED_RESPONSE_HEADERS }
  );
}
