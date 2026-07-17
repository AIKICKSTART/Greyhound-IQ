"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  Dna,
  FileText,
  Gauge,
  Loader2,
  Play,
  type LucideIcon,
} from "lucide-react";
import { m } from "motion/react";
import { MotionIsland } from "@/components/motion/motion-island";
import {
  AGENT_OUTPUT_DISCLAIMER,
  AGENT_PRODUCT_CATALOGUE,
  type AgentType,
} from "@/lib/agent-product-catalogue";

const AGENT_DEMOS = {
  race_analyst: {
    icon: Gauge,
    prompt: "Rank the runners for Race 5 at Wentworth Park.",
    output:
      "Illustrative result: rank the next loaded race using recent finishing positions, recent wins, box draw, and available trainer identity. This preview does not calculate sectionals, track bias, confidence, or true probabilities.",
  },
  breeding_advisor: {
    icon: Dna,
    prompt: "Assess Fernando Bale x Irapsag Miss.",
    output:
      "Illustrative result: report whether the two matched dogs share a sire or dam in the loaded pedigree window. COI, genetic or veterinary risk, litter performance, and earnings are not calculated.",
  },
  form_reader: {
    icon: FileText,
    prompt: "Explain Zipping Megatron's last five starts.",
    output:
      "Illustrative result: summarise up to five loaded finishing positions as improving, mixed, or flat. Box manners, sectionals, mid-race pace, and track bias are not modelled.",
  },
} as const satisfies Record<
  AgentType,
  { icon: LucideIcon; prompt: string; output: string }
>;

const AGENTS = AGENT_PRODUCT_CATALOGUE.map((agent) => ({
  ...agent,
  ...AGENT_DEMOS[agent.type],
}));

function AgentDemoConsoleInner() {
  const [selectedId, setSelectedId] = useState<AgentType>(
    "race_analyst"
  );
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");

  const selected = useMemo(
    () => AGENTS.find((agent) => agent.type === selectedId) ?? AGENTS[0],
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
          const active = agent.type === selectedId;
          return (
            <m.button
              key={agent.type}
              type="button"
              aria-pressed={active}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSelectedId(agent.type);
                setStatus("idle");
              }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] font-semibold transition-[border-color,background-color,color,box-shadow] ${
                active
                  ? "border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.14)] text-[hsl(var(--foreground))] shadow-[0_0_18px_-12px_hsl(var(--primary-bright)/0.9)]"
                  : "border-[hsl(var(--metal-silver)/0.12)] bg-[hsl(0_0%_100%/0.02)] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(0_0%_100%/0.05)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {agent.name}
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
            {status === "running" ? "Preparing preview" : "Synthetic preview"}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[hsl(var(--foreground))]">
            {status === "running"
              ? "Preparing a synthetic example without running the live agent..."
              : selected.output}
          </p>
          {status === "done" && (
            <p className="mt-3 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              {AGENT_OUTPUT_DISCLAIMER}
            </p>
          )}
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
