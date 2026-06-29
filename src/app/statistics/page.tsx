import { BarChart3, Award, MapPin, Users, Target } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { getBoxBias, getTrainerLeaderboard, getTrackRecords } from "@/lib/queries";
import { ProGate } from "@/components/pro-gate";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Statistics — GreyhoundIQ",
  description: "Box bias, trainer leaderboards, track records, and speed maps — the data serious Australian punters use.",
};

// Per-box colour palette (box 1-8) for the bias chart.
const BOX_COLORS = ["#EF4444", "#3B82F6", "#FCD34D", "#1B7A3D", "#F97316", "#8B5CF6", "#EC4899", "#111827"];

export default async function StatisticsPage() {
  const [boxBiasRows, trainerLeaders, trackRecords] = await Promise.all([
    getBoxBias(),
    getTrainerLeaderboard(8),
    getTrackRecords(12),
  ]);
  const BOX_BIAS = boxBiasRows.map((b) => ({ box: b.box, winRate: b.winRate, color: BOX_COLORS[(b.box - 1) % 8] }));
  const TRAINER_LEADERS = trainerLeaders;
  const TRACK_RECORDS = trackRecords;

  return (
    <div className="fade-in">
      <PageHero
        image="/images/feature-advanced-stats.png"
        badge="ADVANCED STATISTICS"
        badgeIcon={<BarChart3 className="h-3 w-3 text-[hsl(25_95%_53%)]" />}
        badgeColor="orange"
        title={
          <>
            Find the
            <br />
            <span className="gradient-text">edges.</span>
          </>
        }
        subtitle="Box bias, trainer form, track records, speed maps — the data serious punters use to make informed decisions."
      />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-center gap-3 mb-6">
          <Target className="h-5 w-5 text-[hsl(25_95%_53%)]" />
          <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)] tracking-[-0.03em]">
            Box Win Rate — All Tracks
          </h2>
        </div>
        <p className="text-[14px] text-[hsl(215_14%_65%)] mb-8 tracking-[-0.013em]">
          National aggregate across 4,800+ meetings. Phase 2 lets you filter by
          track and distance.
        </p>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8">
          <div className="grid grid-cols-8 gap-3 items-end min-h-[240px]">
            {BOX_BIAS.map((b) => (
              <div key={b.box} className="flex flex-col items-center gap-2">
                <div className="text-[11px] font-mono font-semibold text-[hsl(210_13%_97%)]">
                  {b.winRate}%
                </div>
                <div
                  className="w-full rounded-t-md transition-all hover:brightness-110"
                  style={{ height: `${b.winRate * 14}px`, background: b.color }}
                />
                <div
                  className="flex h-7 w-7 items-center justify-center rounded text-[12px] font-bold text-white"
                  style={{ background: b.color }}
                >
                  {b.box}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-[12px] text-[hsl(220_7%_42%)] text-center tracking-[0.04em]">
            BOX NUMBER (1-8) · NATIONAL WIN RATE PERCENTAGE
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-20">
        <ProGate minTier="pro" feature="Advanced statistics">
      <section className="px-0 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-5 w-5 text-[hsl(142_60%_48%)]" />
          <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)] tracking-[-0.03em]">
            Trainer Leaderboard
          </h2>
        </div>
        <p className="text-[14px] text-[hsl(215_14%_65%)] mb-6 tracking-[-0.013em]">
          Top performers by wins over the last 12 months.
        </p>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-[hsl(220_7%_42%)]">
                <th className="text-left p-4 tracking-[0.04em]">Rank</th>
                <th className="text-left p-4 tracking-[0.04em]">Trainer</th>
                <th className="text-right p-4 tracking-[0.04em]">Wins</th>
                <th className="text-right p-4 tracking-[0.04em]">Starters</th>
                <th className="text-right p-4 tracking-[0.04em]">Strike %</th>
                <th className="text-right p-4 tracking-[0.04em]">ROI</th>
              </tr>
            </thead>
            <tbody>
              {TRAINER_LEADERS.map((t, i) => {
                const strike = ((t.wins / t.starters) * 100).toFixed(1);
                const rankBg = i === 0 ? "hsl(25 95% 53% / 0.2)" : "hsl(220 7% 16%)";
                const rankColor = i === 0 ? "hsl(25 95% 53%)" : "hsl(215 14% 65%)";
                return (
                  <tr
                    key={t.name}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="p-4">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                        style={{ background: rankBg, color: rankColor }}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="p-4 text-[14px] font-medium text-[hsl(210_13%_97%)] tracking-[-0.013em]">
                      {t.name}
                    </td>
                    <td className="p-4 text-right text-[13px] text-[hsl(215_14%_65%)] font-mono">{t.wins}</td>
                    <td className="p-4 text-right text-[13px] text-[hsl(215_14%_65%)] font-mono">{t.starters}</td>
                    <td className="p-4 text-right text-[13px] text-[hsl(215_14%_65%)] font-mono">{strike}%</td>
                    <td className="p-4 text-right text-[13px] font-mono font-semibold text-[hsl(142_60%_48%)]">
                      +{t.roi}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="px-0 pb-0">
        <div className="flex items-center gap-3 mb-6">
          <Award className="h-5 w-5 text-[hsl(25_95%_53%)]" />
          <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)] tracking-[-0.03em]">
            Current Track Records
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {TRACK_RECORDS.map((r) => (
            <div
              key={r.track}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-[hsl(210_13%_97%)] tracking-[-0.02em]">
                    {r.track}
                  </h3>
                  <p className="flex items-center gap-1 mt-0.5 text-[11px] text-[hsl(220_7%_42%)]">
                    <MapPin className="h-3 w-3" />
                    {r.dist}m
                  </p>
                </div>
                <span className="rounded-full bg-[hsl(25_95%_53%/0.12)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(25_95%_53%)]">
                  {r.year}
                </span>
              </div>
              <div className="text-2xl font-mono font-semibold text-[hsl(25_95%_53%)]">
                {r.time}s
              </div>
              <p className="text-[12px] text-[hsl(220_7%_42%)] mt-1">
                by <span className="text-[hsl(215_14%_65%)]">{r.dog}</span>
              </p>
            </div>
          ))}
        </div>
      </section>
        </ProGate>
      </div>
    </div>
  );
}
