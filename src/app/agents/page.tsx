import Link from "next/link";
import { CheckCircle2, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { createAgentRun } from "@/app/actions";
import { PageHero } from "@/components/page-hero";
import { AgentDemoConsole } from "@/components/agent-demo-console";
import { ProGate } from "@/components/pro-gate";
import { SubmitButton } from "@/components/submit-button";
import { getAgentRuns } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Agents - GreyhoundIQ",
  description:
    "GreyhoundIQ agent console for race analysis, breeding advice, form reading, moderation, and memory-backed workflows.",
};

const AGENT_CARDS = [
  {
    name: "Race Analyst",
    tier: "Pro+",
    body: "Ranks runners with probabilities, confidence, track bias, trainer signals, and form citations.",
  },
  {
    name: "Breeding Advisor",
    tier: "Pro",
    body: "Checks sire and dam pairings, COI, genetic risk flags, projected litter profile, and earnings index.",
  },
  {
    name: "Form Reader",
    tier: "Free",
    body: "Turns recent starts into a concise explanation of improving, declining, or track-specific form.",
  },
  {
    name: "Moderator",
    tier: "Admin",
    body: "Scans posts, messages, and listings for spam, abuse, and marketplace risk before escalation.",
  },
];

export default async function AgentsPage() {
  const runs = await getAgentRuns(12);
  const completed = runs.filter((run) => run.status === "completed").length;

  return (
    <div className="fade-in">
      <PageHero
        image="/images/wentworth-track-hero.webp"
        title={
          <>
            AI agents for
            <br />
            <span className="gradient-text">racing decisions.</span>
          </>
        }
        subtitle="Race analysis, breeding advice, form reading, moderation, and memory-backed workflows tied to the GreyhoundIQ data spine."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(var(--secondary))] to-[hsl(var(--primary))] px-5 py-2.5 text-[13px] font-semibold text-white shadow-xl shadow-[hsl(var(--primary)/0.25)] transition-all hover:brightness-110"
          >
            Unlock Pro agents
          </Link>
          <Link
            href="/statistics"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[13px] font-semibold text-[hsl(var(--foreground))] transition-all hover:bg-white/[0.06]"
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
            {AGENT_CARDS.map((agent) => (
              <article
                key={agent.name}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
                      {agent.name}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                      {agent.body}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
                    {agent.tier}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <ProGate minTier="pro_plus" feature="Live agent execution">
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <form
              action={createAgentRun}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
            >
              <div className="mb-5">
                <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                  Run an agent
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                  Creates a stored AgentRun, loads relevant memory, writes a new
                  memory entry, and validates the structured output.
                </p>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Agent
                  </span>
                  <select
                    name="agentType"
                    className="mt-2 w-full rounded-lg border border-white/[0.08] bg-[hsl(var(--background))] px-3 py-2 text-[14px] text-[hsl(var(--foreground))] outline-none transition-colors focus:border-[hsl(var(--primary))]"
                    defaultValue="race_analyst"
                  >
                    <option value="race_analyst">Race Analyst</option>
                    <option value="breeding_advisor">Breeding Advisor</option>
                    <option value="form_reader">Form Reader</option>
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
                    className="mt-2 w-full resize-y rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] leading-relaxed text-[hsl(var(--foreground))] outline-none transition-colors placeholder:text-[hsl(var(--subtle-foreground))] focus:border-[hsl(var(--primary))]"
                    placeholder="Top 3 picks for R5 The Meadows Friday"
                  />
                </label>
                <SubmitButton pendingLabel="Running...">Run agent</SubmitButton>
              </div>
            </form>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] uppercase text-[hsl(var(--subtle-foreground))]">
                      <th className="p-3 text-left">Agent</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-right">Tokens</th>
                      <th className="p-3 text-right">Duration</th>
                      <th className="p-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr
                        key={run.id}
                        className="border-b border-white/[0.04] last:border-0"
                      >
                        <td className="p-3 text-[13px] font-medium text-[hsl(var(--foreground))]">
                          {run.agentType.replace(/_/g, " ")}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              run.status === "completed"
                                ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary-bright))]"
                                : "bg-white/[0.05] text-[hsl(var(--muted-foreground))]"
                            }`}
                          >
                            {run.status === "completed" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            {run.status}
                          </span>
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
                      </tr>
                    ))}
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
