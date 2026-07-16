export const MAX_AUTH_REDIRECT_LOCATION_LENGTH = 8_192;

export function applyAuthRedirectContract(
  response: Response,
  allowedBaseUrl: string
) {
  const location = response.headers.get("location");
  if (!location) return true;
  if (location.length > MAX_AUTH_REDIRECT_LOCATION_LENGTH) return false;

  try {
    response.headers.set(
      "Access-Control-Allow-Origin",
      new URL(allowedBaseUrl).origin
    );
    return true;
  } catch {
    return false;
  }
}
