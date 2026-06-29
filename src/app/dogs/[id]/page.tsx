import { notFound } from "next/navigation";
import { getDogById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dog = await getDogById(id);
  return {
    title: dog ? `${dog.name} — GreyhoundIQ` : "Dog not found",
  };
}

export default async function DogProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dog = await getDogById(id);
  if (!dog) notFound();

  const wins = dog.formEntries.filter((e) => e.finish === 1).length;
  const total = dog.formEntries.length;
  const winPct = total > 0 ? ((wins / total) * 100).toFixed(1) : "0";
  const placings = dog.formEntries.filter(
    (e) => e.finish && e.finish <= 3
  ).length;

  const allTimes = dog.formEntries.filter((e) => e.time).map((e) => e.time!);
  const bestTime = allTimes.length > 0 ? Math.min(...allTimes) : null;

  return (
    <div className="fade-in mx-auto max-w-4xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-4xl font-semibold text-[hsl(210_13%_97%)] tracking-[-0.03em]"
        >
          {dog.name}
        </h1>
        <div
          className="flex flex-wrap gap-3 mt-2 text-[13px] text-[hsl(215_14%_65%)] tracking-[-0.013em]"
        >
          {dog.sex && <span>{dog.sex === "M" ? "Dog" : "Bitch"}</span>}
          {dog.colour && <span>· {dog.colour}</span>}
          {dog.trainer && <span>· Trained by {dog.trainer.name}</span>}
          {dog.whelpDate && (
            <span>· Whelped {dog.whelpDate.toLocaleDateString("en-AU")}</span>
          )}
          {dog.earBrand && (
            <span className="font-mono text-[hsl(142_60%_48%)]">· {dog.earBrand}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Starts", value: total, color: "text-[hsl(210_13%_97%)]" },
          { label: `Wins (${winPct}%)`, value: wins, color: "text-[hsl(142_60%_48%)]" },
          { label: "Placings", value: placings, color: "text-[hsl(210_13%_97%)]" },
          { label: "Best Time", value: bestTime ? `${bestTime.toFixed(2)}s` : "—", color: "text-[hsl(25_95%_53%)]" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
            <div className={`text-3xl font-semibold tracking-[-0.02em] ${stat.color}`}>
              {stat.value}
            </div>
            <div className="text-[12px] text-[hsl(220_7%_42%)] mt-1 tracking-[-0.013em]">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Pedigree */}
      {(dog.sire || dog.dam) && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 mb-6">
          <h3
            className="text-[15px] font-semibold text-[hsl(210_13%_97%)] mb-4 tracking-[-0.02em]"
          >
            Pedigree
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[hsl(220_7%_42%)] mb-1">Sire</p>
                <p className="text-[14px] font-medium text-[hsl(210_13%_97%)]">
                  {dog.sire?.name ?? "Unknown"}
                </p>
              </div>
              {dog.sire?.sire && (
                <div className="pl-4 border-l border-[hsl(142_76%_36%/0.3)]">
                  <p className="text-[11px] text-[hsl(220_7%_42%)]">Grand Sire</p>
                  <p className="text-[13px] text-[hsl(215_14%_65%)]">{dog.sire.sire.name}</p>
                </div>
              )}
              {dog.sire?.dam && (
                <div className="pl-4 border-l border-[hsl(142_76%_36%/0.3)]">
                  <p className="text-[11px] text-[hsl(220_7%_42%)]">Grand Dam</p>
                  <p className="text-[13px] text-[hsl(215_14%_65%)]">{dog.sire.dam.name}</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[hsl(220_7%_42%)] mb-1">Dam</p>
                <p className="text-[14px] font-medium text-[hsl(210_13%_97%)]">
                  {dog.dam?.name ?? "Unknown"}
                </p>
              </div>
              {dog.dam?.sire && (
                <div className="pl-4 border-l border-[hsl(25_95%_53%/0.3)]">
                  <p className="text-[11px] text-[hsl(220_7%_42%)]">Grand Sire</p>
                  <p className="text-[13px] text-[hsl(215_14%_65%)]">{dog.dam.sire.name}</p>
                </div>
              )}
              {dog.dam?.dam && (
                <div className="pl-4 border-l border-[hsl(25_95%_53%/0.3)]">
                  <p className="text-[11px] text-[hsl(220_7%_42%)]">Grand Dam</p>
                  <p className="text-[13px] text-[hsl(215_14%_65%)]">{dog.dam.dam.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="p-5 border-b border-white/[0.06]">
          <h3
            className="text-[15px] font-semibold text-[hsl(210_13%_97%)] tracking-[-0.02em]"
          >
            Recent Form
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-[hsl(220_7%_42%)]">
                <th className="text-left p-3 tracking-[0.04em]">Date</th>
                <th className="text-left p-3 tracking-[0.04em]">Track</th>
                <th className="text-center p-3 tracking-[0.04em]">Dist</th>
                <th className="text-center p-3 tracking-[0.04em]">Box</th>
                <th className="text-center p-3 tracking-[0.04em]">Finish</th>
                <th className="text-center p-3 tracking-[0.04em]">Time</th>
              </tr>
            </thead>
            <tbody>
              {dog.formEntries.slice(0, 20).map((entry, i) => (
                <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 text-[13px] text-[hsl(215_14%_65%)] tracking-[-0.013em]">
                    {entry.date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "2-digit" })}
                  </td>
                  <td className="p-3 text-[13px] text-[hsl(210_13%_97%)] font-medium tracking-[-0.013em]">
                    {entry.track?.name ?? "—"}
                  </td>
                  <td className="p-3 text-[13px] text-center text-[hsl(215_14%_65%)] tracking-[-0.013em]">
                    {entry.distance ? `${entry.distance}m` : "—"}
                  </td>
                  <td className="p-3 text-[13px] text-center text-[hsl(215_14%_65%)]">{entry.boxNumber ?? "—"}</td>
                  <td className="p-3 text-center">
                    {entry.finish === 1 ? (
                      <span className="rounded bg-[#FCD34D] px-1.5 py-0.5 text-[11px] font-bold text-gray-900">1</span>
                    ) : (
                      <span className="text-[13px] text-[hsl(215_14%_65%)]">{entry.finish ?? "—"}</span>
                    )}
                  </td>
                  <td className="p-3 text-[13px] text-center text-[hsl(142_60%_48%)] font-mono">
                    {entry.time ? `${entry.time.toFixed(2)}s` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
