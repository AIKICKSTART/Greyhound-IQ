export type NetworkRecoveryState = "online" | "offline" | "restored";

export function initialNetworkRecoveryState(
  browserReportsOnline: boolean,
): NetworkRecoveryState {
  return browserReportsOnline ? "online" : "offline";
}

export function transitionNetworkRecoveryState(
  current: NetworkRecoveryState,
  browserReportsOnline: boolean,
): NetworkRecoveryState {
  if (!browserReportsOnline) return "offline";
  return current === "offline" ? "restored" : current;
}
