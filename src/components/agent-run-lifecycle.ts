export type AgentRunPresentationState =
  | "pending"
  | "running"
  | "completed"
  | "interrupted"
  | "failed";

export type AgentRunPresentation = {
  guidance: string;
  label: string;
  state: AgentRunPresentationState;
};

const AGENT_RUN_PRESENTATIONS = {
  pending: {
    state: "pending",
    label: "Pending",
    guidance: "Waiting for execution capacity. You can cancel before work starts.",
  },
  running: {
    state: "running",
    label: "Running",
    guidance: "The task is in progress. Cancellation is available while it remains active.",
  },
  completed: {
    state: "completed",
    label: "Completed",
    guidance: "The task finished and its recorded usage is final.",
  },
  interrupted: {
    state: "interrupted",
    label: "Interrupted",
    guidance: "The task was cancelled before completion. Start a new run when ready.",
  },
  failed: {
    state: "failed",
    label: "Failed",
    guidance: "The task did not complete. Review the prompt and try a new run.",
  },
} as const satisfies Record<AgentRunPresentationState, AgentRunPresentation>;

export function getAgentRunPresentation(status: string): AgentRunPresentation {
  const normalized = status.trim().toLocaleLowerCase("en-AU");
  if (normalized === "cancelled" || normalized === "canceled") {
    return AGENT_RUN_PRESENTATIONS.interrupted;
  }
  if (normalized === "interrupted") {
    return AGENT_RUN_PRESENTATIONS.interrupted;
  }
  if (normalized in AGENT_RUN_PRESENTATIONS) {
    return AGENT_RUN_PRESENTATIONS[
      normalized as AgentRunPresentationState
    ];
  }
  return AGENT_RUN_PRESENTATIONS.failed;
}

export function isAgentRunCancellable(status: string) {
  const state = getAgentRunPresentation(status).state;
  return state === "pending" || state === "running";
}
