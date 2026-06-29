"use client";

import { useMemo, useState } from "react";
import { Bot, Dna, FileText, Gauge, Loader2, Play } from "lucide-react";

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

export function AgentDemoConsole() {
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
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-[hsl(210_13%_97%)]">
            Agent console
          </h2>
          <p className="mt-1 text-[13px] text-[hsl(215_14%_65%)]">
            Quick preview of each agent output contract.
          </p>
        </div>
        <Bot className="h-5 w-5 text-[hsl(142_60%_48%)]" />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const active = agent.id === selectedId;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => {
                setSelectedId(agent.id);
                setStatus("idle");
              }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] font-semibold transition-all ${
                active
                  ? "border-[hsl(142_76%_36%/0.6)] bg-[hsl(142_76%_36%/0.14)] text-[hsl(210_13%_97%)]"
                  : "border-white/[0.06] bg-white/[0.02] text-[hsl(215_14%_65%)] hover:bg-white/[0.05]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {agent.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border border-white/[0.06] bg-[hsl(150_30%_3%/0.55)] p-4">
        <p className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
          Prompt
        </p>
        <p className="mt-2 text-[14px] text-[hsl(210_13%_97%)]">
          {selected.prompt}
        </p>
      </div>

      <button
        type="button"
        onClick={runDemo}
        disabled={status === "running"}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(142_76%_36%)] to-[hsl(142_60%_40%)] px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-[hsl(142_76%_36%/0.2)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        Preview run
      </button>

      {status !== "idle" && (
        <div className="mt-4 rounded-lg border border-[hsl(142_76%_36%/0.25)] bg-[hsl(142_76%_36%/0.08)] p-4">
          <p className="text-[12px] font-semibold uppercase text-[hsl(142_60%_48%)]">
            {status === "running" ? "Running" : "Completed"}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[hsl(210_13%_97%)]">
            {status === "running"
              ? "Loading memory, assembling context, validating output schema..."
              : selected.output}
          </p>
        </div>
      )}
    </div>
  );
}
