import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Clock, Lock, ShieldCheck } from "lucide-react";
import { claimDogOwnership } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { getDogById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dog = await getDogById(id);
  if (!dog) return {
    title: "Dog not found — GreyhoundIQ",
    description: "Greyhound profile not found in the national database.",
  };
  return {
    title: `${dog.name} — GreyhoundIQ`,
    description: `Full career form, recent starts, pedigree, and trainer info for ${dog.name}.`,
  };
}

export default async function DogProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [dog, user] = await Promise.all([getDogById(id), getCurrentUser()]);
  if (!dog) notFound();

  const verifiedOwnership = dog.ownership.filter((entry) => entry.verified);
  const currentOwnership = user?.profileId
    ? dog.ownership.find((entry) => entry.profileId === user.profileId)
    : null;
  const claimAction = claimDogOwnership.bind(null, dog.id);

  const wins = dog.formEntries.filter((e) => e.finish === 1).length;
  const total = dog.formEntries.length;
  const winPct = total > 0 ? ((wins / total) * 100).toFixed(1) : "0";
  const placings = dog.formEntries.filter(
    (e) => e.finish && e.finish <= 3
  ).length;

  const allTimes = dog.formEntries.filter((e) => e.time).map((e) => e.time!);
  const bestTime = allTimes.length > 0 ? Math.min(...allTimes) : null;

  return (
    <div className="giq-dog-detail-page fade-in mx-auto max-w-4xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-4xl font-semibold text-[hsl(var(--foreground))] tracking-[-0.03em]"
        >
          {dog.name}
        </h1>
        <div
          className="flex flex-wrap gap-3 mt-2 text-[13px] text-[hsl(var(--muted-foreground))] tracking-[-0.013em]"
        >
          {dog.sex && <span>{dog.sex === "M" ? "Dog" : "Bitch"}</span>}
          {dog.colour && <span>· {dog.colour}</span>}
          {dog.trainer && <span>· Trained by {dog.trainer.name}</span>}
          {dog.whelpDate && (
            <span>· Whelped {dog.whelpDate.toLocaleDateString("en-AU")}</span>
          )}
          {dog.earBrand && (
            <span className="font-mono text-[hsl(var(--primary-bright))]">· {dog.earBrand}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="giq-dog-stat-grid grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Starts", value: total, color: "text-[hsl(var(--foreground))]" },
          { label: `Wins (${winPct}%)`, value: wins, color: "text-[hsl(var(--primary-bright))]" },
          { label: "Placings", value: placings, color: "text-[hsl(var(--foreground))]" },
          { label: "Best Time", value: bestTime ? `${bestTime.toFixed(2)}s` : "—", color: "text-[hsl(var(--secondary))]" },
        ].map((stat) => (
          <div key={stat.label} className="giq-metric-card text-center">
            <div className={`text-3xl font-semibold tracking-[-0.02em] ${stat.color}`}>
              {stat.value}
            </div>
            <div className="text-[12px] text-[hsl(var(--subtle-foreground))] mt-1 tracking-[-0.013em]">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Ownership */}
      <section className="giq-panel mb-6 p-6">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
            Ownership
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            {verifiedOwnership.length > 0 ? (
              verifiedOwnership.map((entry) => (
                <div
                  key={entry.id}
                  className="giq-subpanel flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-semibold text-[hsl(var(--foreground))]">
                      {entry.profile.displayName}
                    </p>
                    <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatRole(entry.role)}
                      {entry.profile.kennelName ? ` · ${entry.profile.kennelName}` : ""}
                      {entry.profile.state ? ` · ${entry.profile.state}` : ""}
                    </p>
                  </div>
                  <OwnershipBadge verified />
                </div>
              ))
            ) : (
              <div className="giq-dashed-panel p-4">
                <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
                  No verified profile is linked to this dog yet.
                </p>
              </div>
            )}

            {currentOwnership && !currentOwnership.verified && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[hsl(var(--secondary)/0.25)] bg-[hsl(var(--secondary)/0.08)] p-4">
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">
                    Your claim is pending
                  </p>
                  <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                    {formatRole(currentOwnership.role)} claim submitted for review.
                  </p>
                </div>
                <OwnershipBadge verified={false} />
              </div>
            )}
          </div>

          <div className="giq-subpanel p-4">
            {user ? (
              currentOwnership ? (
                <div>
                  <OwnershipBadge verified={currentOwnership.verified} />
                  <p className="mt-3 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    This dog is linked to your GreyhoundIQ profile as{" "}
                    {formatRole(currentOwnership.role)}.
                  </p>
                  <Link
                    href="/account"
                    className="giq-outline-action mt-4"
                  >
                    Manage profile
                  </Link>
                </div>
              ) : (
                <form action={claimAction} className="grid gap-4">
                  <label className="block">
                    <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                      Claim role
                    </span>
                    <select
                      name="role"
                      className="giq-form-control mt-2 px-3 py-2"
                      defaultValue="owner"
                    >
                      <option value="owner">Owner</option>
                      <option value="co-owner">Co-owner</option>
                      <option value="breeder">Breeder</option>
                      <option value="trainer">Trainer</option>
                    </select>
                  </label>
                  <SubmitButton pendingLabel="Submitting claim...">
                    Claim dog
                  </SubmitButton>
                </form>
              )
            ) : (
              <div>
                <Lock className="mb-3 h-5 w-5 text-[hsl(var(--primary-bright))]" />
                <p className="text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                  Sign in to link this dog to your GreyhoundIQ profile.
                </p>
                <Link
                  href="/sign-in"
                  className="giq-liquid-purple-button mt-4 min-h-10 px-4 text-[13px] font-semibold"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pedigree */}
      {(dog.sire || dog.dam) && (
        <div className="giq-panel mb-6 p-6">
          <h3
            className="text-[15px] font-semibold text-[hsl(var(--foreground))] mb-4 tracking-[-0.02em]"
          >
            Pedigree
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--subtle-foreground))] mb-1">Sire</p>
                <p className="text-[14px] font-medium text-[hsl(var(--foreground))]">
                  {dog.sire?.name ?? "Unknown"}
                </p>
              </div>
              {dog.sire?.sire && (
                <div className="pl-4 border-l border-[hsl(var(--primary)/0.3)]">
                  <p className="text-[11px] text-[hsl(var(--subtle-foreground))]">Grand Sire</p>
                  <p className="text-[13px] text-[hsl(var(--muted-foreground))]">{dog.sire.sire.name}</p>
                </div>
              )}
              {dog.sire?.dam && (
                <div className="pl-4 border-l border-[hsl(var(--primary)/0.3)]">
                  <p className="text-[11px] text-[hsl(var(--subtle-foreground))]">Grand Dam</p>
                  <p className="text-[13px] text-[hsl(var(--muted-foreground))]">{dog.sire.dam.name}</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--subtle-foreground))] mb-1">Dam</p>
                <p className="text-[14px] font-medium text-[hsl(var(--foreground))]">
                  {dog.dam?.name ?? "Unknown"}
                </p>
              </div>
              {dog.dam?.sire && (
                <div className="pl-4 border-l border-[hsl(var(--secondary)/0.3)]">
                  <p className="text-[11px] text-[hsl(var(--subtle-foreground))]">Grand Sire</p>
                  <p className="text-[13px] text-[hsl(var(--muted-foreground))]">{dog.dam.sire.name}</p>
                </div>
              )}
              {dog.dam?.dam && (
                <div className="pl-4 border-l border-[hsl(var(--secondary)/0.3)]">
                  <p className="text-[11px] text-[hsl(var(--subtle-foreground))]">Grand Dam</p>
                  <p className="text-[13px] text-[hsl(var(--muted-foreground))]">{dog.dam.dam.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form table */}
      <div className="giq-table-shell">
        <div className="border-b border-white/[0.06] p-5">
          <h3
            className="text-[15px] font-semibold text-[hsl(var(--foreground))] tracking-[-0.02em]"
          >
            Recent Form
          </h3>
        </div>
        <div className="grid gap-3 p-3 sm:hidden">
          {dog.formEntries.slice(0, 20).map((entry, i) => (
            <article key={i} className="giq-subpanel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
                    {entry.track?.name ?? "Unknown track"}
                  </p>
                  <p className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))]">
                    {entry.date.toLocaleDateString("en-AU", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[13px] font-semibold text-[hsl(var(--primary-bright))]">
                    {entry.time ? `${entry.time.toFixed(2)}s` : "-"}
                  </p>
                  <p className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))]">
                    {entry.distance ? `${entry.distance}m` : "-"}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-[hsl(var(--muted-foreground))]">
                <span>Box {entry.boxNumber ?? "-"}</span>
                <span className="text-right">Finish {entry.finish ?? "-"}</span>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full">
            <thead>
              <tr className="giq-table-head">
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
                <tr key={i} className="giq-table-row">
                  <td className="p-3 text-[13px] text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
                    {entry.date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "2-digit" })}
                  </td>
                  <td className="p-3 text-[13px] text-[hsl(var(--foreground))] font-medium tracking-[-0.013em]">
                    {entry.track?.name ?? "—"}
                  </td>
                  <td className="p-3 text-[13px] text-center text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
                    {entry.distance ? `${entry.distance}m` : "—"}
                  </td>
                  <td className="p-3 text-[13px] text-center text-[hsl(var(--muted-foreground))]">{entry.boxNumber ?? "—"}</td>
                  <td className="p-3 text-center">
                    {entry.finish === 1 ? (
                      <span className="rounded bg-[hsl(var(--secondary-light))] px-1.5 py-0.5 text-[11px] font-bold text-[hsl(var(--secondary-foreground))]">1</span>
                    ) : (
                      <span className="text-[13px] text-[hsl(var(--muted-foreground))]">{entry.finish ?? "—"}</span>
                    )}
                  </td>
                  <td className="p-3 text-[13px] text-center text-[hsl(var(--primary-bright))] font-mono">
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

function OwnershipBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`giq-status-pill ${
        verified
          ? "giq-status-pill-purple"
          : "giq-status-pill-gold"
      }`}
    >
      {verified ? (
        <BadgeCheck className="h-3.5 w-3.5" />
      ) : (
        <Clock className="h-3.5 w-3.5" />
      )}
      {verified ? "Verified" : "Pending"}
    </span>
  );
}

function formatRole(role: string) {
  return role
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}
