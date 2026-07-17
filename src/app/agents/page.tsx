import Link from "next/link";
import {
  CheckCircle2,
  CircleX,
  Clock,
  ShieldCheck,
  Sparkles,
  Square,
} from "lucide-react";
import { createAgentRun } from "@/app/actions";
import { PageHero } from "@/components/page-hero";
import { AgentDemoConsole } from "@/components/agent-demo-console";
import { AgentRunCancelButton } from "@/components/agent-run-cancel-button";
import { getAgentRunPresentation } from "@/components/agent-run-lifecycle";
import { ProGate } from "@/components/pro-gate";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser, hasTier } from "@/lib/auth";
import {
  AGENT_OUTPUT_DISCLAIMER,
  AGENT_PRODUCT_CATALOGUE,
  agentTierLabel,
} from "@/lib/agent-product-catalogue";
import { getAgentRuns } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Agents - GreyhoundIQ",
  description:
    "GreyhoundIQ agent console for race analysis, breeding advice, form reading, and memory-backed workflows.",
};

export default async function AgentsPage() {
  const user = await getCurrentUser();
  const runs = user?.dbUserId
    ? await getAgentRuns(
        {
          dbUserId: user.dbUserId,
          profileId: user.profileId ?? user.dbUserId,
          profileRole: user.role ?? "member",
          tier: user.tier,
        },
        12
      )
    : [];
  const completed = runs.filter((run) => run.status === "completed").length;

  return (
    <div>
      <PageHero
        image="/images/feature-ai-predictions-blue.webp"
        title={
          <>
            AI agents for
            <br />
            <span className="gradient-text">racing decisions.</span>
          </>
        }
        subtitle="Race analysis, breeding advice, and form reading with explicit data limits, tier checks, and memory-backed run history."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="giq-liquid-purple-button px-5 text-[13px] font-semibold"
          >
            Unlock Pro agents
          </Link>
          <Link
            href="/statistics"
            className="giq-button giq-button-glass px-5 text-[13px] font-semibold"
          >
            View statistics
          </Link>
        </div>
      </PageHero>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[1fr_1fr]">
        <AgentDemoConsole />

        <div>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                Agent lineup
              </h2>
              <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
                Agents backed by stored runs, tier checks, and user memory.
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-[hsl(var(--secondary))]" />
          </div>
          <div className="grid gap-3">
            {AGENT_PRODUCT_CATALOGUE.map((agent) => (
              <article
                key={agent.type}
                className="giq-panel giq-panel-hover p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
                      {agent.name}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                      {agent.capability}
                    </p>
                    <p className="mt-2 text-[12px] leading-relaxed text-[hsl(var(--subtle-foreground))]">
                      <span className="font-semibold">Current limit:</span>{" "}
                      {agent.limitation}
                    </p>
                  </div>
                  <span className="giq-badge giq-badge-neutral">
                    {agentTierLabel(agent.minimumTier)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="giq-subpanel mb-6 p-5">
          <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
            What a run stores and what it cannot change
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            A run stores your prompt and output, conversation context, usage and
            audit records, and user-owned memory. A follow-up may be recorded as
            pending, but it is never executed automatically.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Agent output does not publish content, edit racing records, change
            billing or account settings, or perform administrative actions.
            {" "}{AGENT_OUTPUT_DISCLAIMER}
          </p>
        </div>

        <ProGate minTier="pro" feature="Live agent execution">
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <form
              action={createAgentRun}
              className="giq-panel p-6"
            >
              <div className="mb-5">
                <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                  Run an agent
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                  Creates a stored AgentRun, loads relevant memory, writes a new
                  memory entry, and validates the structured output.
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-[hsl(var(--subtle-foreground))]">
                  Race Analyst and Form Reader require Pro. Breeding Advisor
                  requires Pro+.
                </p>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Agent
                  </span>
                  <select
                    name="agentType"
                    className="giq-form-control mt-2 px-3 py-2"
                    defaultValue="race_analyst"
                  >
                    {AGENT_PRODUCT_CATALOGUE.map((agent) => {
                      const unavailable = Boolean(
                        user && !hasTier(user.tier, agent.minimumTier)
                      );

                      return (
                        <option
                          key={agent.type}
                          value={agent.type}
                          disabled={unavailable}
                        >
                          {agent.name} · {agentTierLabel(agent.minimumTier)}
                          {unavailable ? " — upgrade required" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Prompt
                  </span>
                  <textarea
                    name="input"
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={7}
                    className="giq-form-control giq-textarea mt-2 px-3 py-2"
                    placeholder="Top 3 picks for R5 The Meadows Friday"
                  />
                </label>
                <SubmitButton pendingLabel="Running...">Run agent</SubmitButton>
              </div>
            </form>

            <div className="giq-panel p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                  Recent agent runs
                </h2>
                <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
                  {runs.length} stored runs, {completed} completed.
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
            </div>

            {runs.length === 0 ? (
              <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
                No agent runs recorded yet.
              </p>
            ) : (
              <div className="giq-table-shell overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="giq-table-head">
                      <th className="p-3 text-left">Agent</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-right">Tokens</th>
                      <th className="p-3 text-right">Duration</th>
                      <th className="p-3 text-right">Created</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => {
                      const presentation = getAgentRunPresentation(run.status);
                      const StatusIcon =
                        presentation.state === "completed"
                          ? CheckCircle2
                          : presentation.state === "failed"
                            ? CircleX
                            : presentation.state === "interrupted"
                              ? Square
                              : Clock;

                      return (
                        <tr key={run.id} className="giq-table-row">
                        <td className="p-3 text-[13px] font-medium text-[hsl(var(--foreground))]">
                          {run.agentType.replace(/_/g, " ")}
                        </td>
                        <td className="p-3">
                          <span
                            data-agent-run-state={presentation.state}
                            title={presentation.guidance}
                            className={`giq-status-pill ${
                              presentation.state === "completed"
                                ? "giq-status-pill-purple"
                                : ""
                            }`}
                          >
                            <StatusIcon className="h-3 w-3" aria-hidden="true" />
                            {presentation.label}
                          </span>
                          <span className="sr-only">{presentation.guidance}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-[12px] text-[hsl(var(--muted-foreground))]">
                          {(run.promptTokens ?? 0) + (run.completionTokens ?? 0)}
                        </td>
                        <td className="p-3 text-right font-mono text-[12px] text-[hsl(var(--muted-foreground))]">
                          {run.durationMs ? `${run.durationMs}ms` : "-"}
                        </td>
                        <td className="p-3 text-right text-[12px] text-[hsl(var(--subtle-foreground))]">
                          {run.createdAt.toLocaleDateString("en-AU")}
                        </td>
                        <td className="p-3 text-right">
                          <AgentRunCancelButton runId={run.id} status={run.status} />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        </ProGate>
      </section>
    </div>
  );
}
