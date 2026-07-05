import { MediaDeviceFailure } from "livekit-client";

export type CallMediaKind = "microphone" | "camera" | "screen";

export function callMediaErrorMessage(err: unknown, kind: CallMediaKind): string {
  switch (MediaDeviceFailure.getFailure(err)) {
    case MediaDeviceFailure.PermissionDenied:
      return `Allow ${kind} access in your browser settings and try again`;
    case MediaDeviceFailure.NotFound:
      return `No ${kind} detected`;
    case MediaDeviceFailure.DeviceInUse:
      return `Your ${kind} is in use by another app`;
    default:
      return err instanceof Error && err.message
        ? err.message
        : `Could not access ${kind}`;
  }
}
