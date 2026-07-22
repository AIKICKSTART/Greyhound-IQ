// Pure window-manager state for the Messenger-style chat dock. Kept free of
// React/DOM so the open/minimize/restore/ordering rules stay unit-testable.

export type DockWindowStatus = "open" | "minimized";

export interface DockWindow {
  id: string;
  status: DockWindowStatus;
}

export type DockAction =
  | { type: "open"; id: string }
  | { type: "minimize"; id: string }
  | { type: "close"; id: string };

// Facebook Messenger keeps a small number of expanded windows and pushes the
// rest to minimized bubbles. Two fits GreyhoundIQ's desktop dock width.
export const MAX_OPEN_WINDOWS = 2;

export function dockReducer(
  state: DockWindow[],
  action: DockAction
): DockWindow[] {
  switch (action.type) {
    case "open": {
      // Re-open (or restore) moves the conversation to the end so it counts as
      // the most-recently-opened window when the cap is enforced.
      const rest = state.filter((window) => window.id !== action.id);
      return enforceOpenCap([...rest, { id: action.id, status: "open" }]);
    }
    case "minimize":
      return state.map((window) =>
        window.id === action.id
          ? { ...window, status: "minimized" }
          : window
      );
    case "close":
      return state.filter((window) => window.id !== action.id);
    default:
      return state;
  }
}

// Keep the most-recently-opened windows expanded; demote older ones to bubbles.
function enforceOpenCap(windows: DockWindow[]): DockWindow[] {
  const openIds = windows
    .filter((window) => window.status === "open")
    .map((window) => window.id);
  if (openIds.length <= MAX_OPEN_WINDOWS) return windows;
  const keep = new Set(openIds.slice(-MAX_OPEN_WINDOWS));
  return windows.map((window) =>
    window.status === "open" && !keep.has(window.id)
      ? { ...window, status: "minimized" }
      : window
  );
}

export function openWindowIds(windows: DockWindow[]): string[] {
  return windows
    .filter((window) => window.status === "open")
    .map((window) => window.id);
}

export function minimizedWindowIds(windows: DockWindow[]): string[] {
  return windows
    .filter((window) => window.status === "minimized")
    .map((window) => window.id);
}
