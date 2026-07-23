export type AuthCallbackFailureReason =
  | "cancelled"
  | "expired"
  | "provider"
  | "failed";

export const AUTH_CALLBACK_RECOVERY_COPY: Record<
  AuthCallbackFailureReason,
  { title: string; description: string }
> = {
  cancelled: {
    title: "Sign-in was cancelled",
    description:
      "No account changes were made. You can try again whenever you are ready.",
  },
  expired: {
    title: "That sign-in session expired",
    description:
      "Start a new sign-in attempt so we can verify a fresh, single-use session.",
  },
  provider: {
    title: "Sign-in is temporarily unavailable",
    description:
      "The authentication service did not complete the request. Please retry in a moment.",
  },
  failed: {
    title: "We could not complete sign-in",
    description:
      "Your session was not created. Retry safely or contact support if the problem continues.",
  },
};

export function classifyAuthCallbackFailure(
  errorCode: string | null
): AuthCallbackFailureReason {
  if (errorCode === "access_denied") return "cancelled";
  if (
    errorCode === "invalid_grant" ||
    errorCode === "interaction_required" ||
    errorCode === "login_required"
  ) {
    return "expired";
  }
  if (errorCode === "server_error" || errorCode === "temporarily_unavailable") {
    return "provider";
  }
  return "failed";
}

export function parseAuthCallbackFailureReason(
  value: string | string[] | undefined
): AuthCallbackFailureReason {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && candidate in AUTH_CALLBACK_RECOVERY_COPY
    ? (candidate as AuthCallbackFailureReason)
    : "failed";
}

export function parseAuthCallbackReference(
  value: string | string[] | undefined
) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      candidate
    )
    ? candidate
    : undefined;
}
