"use client";

import { useMemo, useState } from "react";
import { Bot, Dna, FileText, Gauge, Loader2, Play } from "lucide-react";
import { m } from "motion/react";
import { MotionIsland } from "@/components/motion/motion-island";

const AGENTS = [
  {
    id: "race_analyst",
    label: "Race Analyst",
    icon: Gauge,
    prompt: "Rank the runners for Race 5 at Wentworth Park.",
    output:
      "Top pick: Box 4. Strong recent sectional pattern, inside bias is active, and trainer strike rate is above the meeting average.",
  },
  {
    id: "breeding_advisor",
    label: "Breeding Advisor",
    icon: Dna,
    prompt: "Assess Fernando Bale x Irapsag Miss.",
    output:
      "Projected litter profile: low COI range, strong early pace signal, and no seeded recessive-risk overlap in the loaded pedigree.",
  },
  {
    id: "form_reader",
    label: "Form Reader",
    icon: FileText,
    prompt: "Explain Zipping Megatron's last five starts.",
    output:
      "Pattern: reliable box manners and improving mid-race pace. The weak runs cluster around wider draws at shorter trips.",
  },
] as const;

function AgentDemoConsoleInner() {
  const [selectedId, setSelectedId] = useState<(typeof AGENTS)[number]["id"]>(
    "race_analyst"
  );
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");

  const selected = useMemo(
    () => AGENTS.find((agent) => agent.id === selectedId) ?? AGENTS[0],
    [selectedId]
  );

  function runDemo() {
    setStatus("running");
    window.setTimeout(() => setStatus("done"), 650);
  }

  return (
    <div className="giq-panel p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
            Agent console
          </h2>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            Quick preview of each agent output contract.
          </p>
        </div>
        <Bot className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const active = agent.id === selectedId;
          return (
            <m.button
              key={agent.id}
              type="button"
              aria-pressed={active}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSelectedId(agent.id);
                setStatus("idle");
              }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] font-semibold transition-[border-color,background-color,color,box-shadow] ${
                active
                  ? "border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.14)] text-[hsl(var(--foreground))] shadow-[0_0_18px_-12px_hsl(var(--primary-bright)/0.9)]"
                  : "border-[hsl(var(--metal-silver)/0.12)] bg-[hsl(0_0%_100%/0.02)] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(0_0%_100%/0.05)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {agent.label}
            </m.button>
          );
        })}
      </div>

      <div className="giq-subpanel mt-5 p-4">
        <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          Prompt
        </p>
        <p className="mt-2 text-[14px] text-[hsl(var(--foreground))]">
          {selected.prompt}
        </p>
      </div>

      <button
        type="button"
        onClick={runDemo}
        disabled={status === "running"}
        className="giq-liquid-purple-button mt-4 min-h-10 px-4 text-[13px] font-semibold"
      >
        {status === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        Preview run
      </button>

      {status !== "idle" && (
        <m.div
          role="status"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="giq-subpanel mt-4 border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.08)] p-4"
        >
          <p className="text-[12px] font-semibold uppercase text-[hsl(var(--primary-bright))]">
            {status === "running" ? "Running" : "Completed"}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[hsl(var(--foreground))]">
            {status === "running"
              ? "Loading memory, assembling context, validating output schema..."
              : selected.output}
          </p>
        </m.div>
      )}
    </div>
  );
}

export function AgentDemoConsole() {
  return (
    <MotionIsland>
      <AgentDemoConsoleInner />
    </MotionIsland>
  );
}
