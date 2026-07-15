import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  Ban,
  ChevronDown,
  Clock,
  Lock,
  Play,
  ShieldCheck,
} from "lucide-react";
import { claimDogOwnership } from "@/app/actions";
import { FinishBadge } from "@/components/finish-badge";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { resolveDemoProviderRouteId } from "@/lib/demo-route-samples";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";
import { getDogById, getMyDogOwnership } from "@/lib/queries";
import { getDogPedigree } from "@/lib/pedigree";
import { PedigreeChart } from "@/components/pedigree-chart";
import { getBoxColourStyle } from "@/lib/box-colours";
import { absoluteTheDogsUrl } from "@/lib/live/thedogs-replay";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: routeId } = await params;
  const id = await resolveDemoProviderRouteId("dog", routeId);
  const dog = await getDogById(id);
  if (!dog) return {
    title: "Dog not found — GreyhoundIQ",
    description: "Greyhound profile not found in the national database.",
  };
  const description = `Full career form, recent starts, pedigree, and trainer info for ${dog.name}.`;
  return {
    title: `${dog.name} — Greyhound Form & Pedigree | GreyhoundIQ`,
    description,
    alternates: { canonical: `/dogs/${id}` },
    openGraph: {
      title: `${dog.name} — Greyhound Form & Pedigree | GreyhoundIQ`,
      description,
      url: `/dogs/${id}`,
      type: "profile",
    },
  };
}

export default async function DogProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: routeId } = await params;
  const id = await resolveDemoProviderRouteId("dog", routeId);
  const [dog, user, pedigree] = await Promise.all([
    getDogById(id),
    getCurrentUser(),
    getDogPedigree(id),
  ]);
  if (!dog) notFound();

  const approvedOwnership = dog.ownership.filter(
    (entry) => entry.status === "approved"
  );
  // getDogById runs without request context, so RLS hides the claimant's own
  // pending/rejected row from dog.ownership. Fetch it under the user's context.
  const currentOwnership =
    user?.dbUserId && user.profileId && user.role
      ? await getMyDogOwnership(
          {
            dbUserId: user.dbUserId,
            profileId: user.profileId,
            profileRole: user.role,
            tier: user.tier,
          },
          dog.id
        )
      : null;
  const claimAction = claimDogOwnership.bind(null, dog.id);

  const wins = dog.formEntries.filter((e) => e.finish === 1).length;
  const total = dog.formEntries.length;
  const winPct = total > 0 ? ((wins / total) * 100).toFixed(1) : "0";
  const placings = dog.formEntries.filter(
    (e) => e.finish && e.finish <= 3
  ).length;

  const recentForm = buildRecentForm(dog);

  const dogSchema = {
    "@context": "https://schema.org",
    "@type": "Animal",
    "@id": `https://greyhoundsiq.com.au/dogs/${dog.id}`,
    name: dog.name,
    url: `https://greyhoundsiq.com.au/dogs/${dog.id}`,
    description: `Full career form, recent starts, pedigree, and trainer info for ${dog.name}.`,
    ...(dog.colour ? { color: dog.colour } : {}),
    ...(dog.sex ? { gender: dog.sex === "M" ? "Male" : "Female" } : {}),
    ...(dog.trainer
      ? { trainer: { "@type": "Person", name: dog.trainer.name } }
      : {}),
  };

  return (
    <div className="giq-dog-detail-page mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Dogs", path: "/dogs" },
            { name: dog.name, path: `/dogs/${dog.id}` },
          ]),
          dogSchema,
        ]}
      />
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
          {/* Internal source identifiers (e.g. "thedogs:443230") must never be
              shown; only surface a genuine ear brand if one exists. */}
          {dog.earBrand && !dog.earBrand.includes(":") && (
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
          {
            label: "Prize Money",
            value: dog.prizeMoney == null ? "—" : formatPrize(dog.prizeMoney),
            color: "text-[hsl(var(--secondary))]",
          },
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
            {approvedOwnership.length > 0 ? (
              approvedOwnership.map((entry) => (
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
                  <OwnershipBadge status="approved" />
                </div>
              ))
            ) : (
              <div className="giq-dashed-panel p-4">
                <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
                  No verified profile is linked to this dog yet.
                </p>
              </div>
            )}

            {currentOwnership && currentOwnership.status === "pending" && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[hsl(var(--secondary)/0.25)] bg-[hsl(var(--secondary)/0.08)] p-4">
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">
                    Claim pending review
                  </p>
                  <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                    {formatRole(currentOwnership.role)} claim submitted for review.
                  </p>
                </div>
                <OwnershipBadge status="pending" />
              </div>
            )}

            {currentOwnership && currentOwnership.status === "rejected" && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.08)] p-4">
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">
                    Claim not approved
                  </p>
                  <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                    {currentOwnership.rejectionReason
                      ? currentOwnership.rejectionReason
                      : "A moderator declined this ownership claim."}
                  </p>
                </div>
                <OwnershipBadge status="rejected" />
              </div>
            )}
          </div>

          <div className="giq-subpanel p-4">
            {user ? (
              currentOwnership ? (
                <div>
                  <OwnershipBadge status={currentOwnership.status} />
                  <p className="mt-3 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {currentOwnership.status === "approved"
                      ? `This dog is linked to your GreyhoundIQ profile as ${formatRole(currentOwnership.role)}.`
                      : currentOwnership.status === "rejected"
                        ? `Your ${formatRole(currentOwnership.role)} claim was not approved.`
                        : `Your ${formatRole(currentOwnership.role)} claim is awaiting moderator review.`}
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
                  <label className="block">
                    <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                      Evidence (optional)
                    </span>
                    <textarea
                      name="evidence"
                      rows={3}
                      maxLength={1000}
                      placeholder="How can we verify this link? e.g. registration papers, kennel records."
                      className="giq-form-control giq-textarea mt-2 px-3 py-2"
                    />
                  </label>
                  <SubmitButton pendingLabel="Submitting claim...">
                    Request ownership
                  </SubmitButton>
                </form>
              )
            ) : (
              <div>
                <Lock className="mb-3 h-5 w-5 text-[hsl(var(--primary-bright))]" />
                <p className="text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                  Sign in to link this dog to your GreyhoundIQ profile.
                </p>
                <a
                  href="/sign-in"
                  className="giq-liquid-purple-button mt-4 min-h-10 px-4 text-[13px] font-semibold"
                >
                  Sign in
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pedigree — deep studbook graph when available, else immediate parents */}
      {pedigree ? (
        <PedigreeChart root={pedigree} />
      ) : (
        (dog.sire || dog.dam) && (
          <div className="giq-panel mb-6 p-6">
            <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))] mb-4 tracking-[-0.02em]">
              Pedigree
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--subtle-foreground))] mb-1">Sire</p>
                <p className="text-[14px] font-medium text-[hsl(var(--foreground))]">
                  {dog.sire?.name ?? "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--subtle-foreground))] mb-1">Dam</p>
                <p className="text-[14px] font-medium text-[hsl(var(--foreground))]">
                  {dog.dam?.name ?? "Unknown"}
                </p>
              </div>
            </div>
          </div>
        )
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
        <div className="divide-y divide-white/[0.06] lg:hidden">
          {recentForm.map((entry) => (
            <details key={entry.id} className="group">
              <summary className="grid min-h-[64px] cursor-pointer list-none grid-cols-[minmax(72px,1fr)_36px_52px_58px_20px] items-center gap-1.5 px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[hsl(var(--primary-bright))] [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-[12px] tabular-nums text-[hsl(var(--muted-foreground))]">
                    {formatFormDate(entry.date)}
                  </span>
                  <span className="mt-1 block truncate text-[14px] font-semibold text-[hsl(var(--foreground))]">
                    {entry.trackName}
                  </span>
                </span>
                <FormSummaryValue label="Box">
                  <BoxPlate boxNumber={entry.boxNumber} />
                </FormSummaryValue>
                <FormSummaryValue label="Finish">
                  <FinishBadge finish={entry.finish} />
                </FormSummaryValue>
                <FormSummaryValue label="Time">
                  <span className="font-mono text-[13px] font-semibold text-[hsl(var(--primary-bright))]">
                    {formatSeconds(entry.time)}
                  </span>
                </FormSummaryValue>
                <ChevronDown
                  className="h-5 w-5 text-[hsl(var(--muted-foreground))] transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="mx-3 mb-3 rounded-[10px] border border-white/[0.07] bg-white/[0.025] p-4">
                <dl className="grid grid-cols-4 gap-3 border-b border-white/[0.06] pb-4">
                  <FormDetail label="Dist" value={formatDistance(entry.distance)} />
                  <FormDetail label="Grade" value={entry.grade ?? "—"} />
                  <FormDetail label="Wgt" value={formatWeight(entry.weight)} />
                  <FormDetail label="1st Sec" value={formatNumber(entry.firstSectional)} />
                </dl>
                <dl className="mt-4 grid grid-cols-[minmax(52px,0.7fr)_minmax(0,1.7fr)_80px] items-center gap-3">
                  <FormDetail label="Mgn" value={formatNumber(entry.margin)} />
                  <FormDetail label="Winner / 2nd" value={entry.winnerDogName ?? "—"} />
                  <div className="grid min-w-[80px] justify-items-center gap-2">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
                      Video
                    </dt>
                    <ReplayLink href={entry.replayHref} />
                  </div>
                </dl>
              </div>
            </details>
          ))}
        </div>
        <div className="hidden lg:block">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: "9%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "6%" }} />
            </colgroup>
            <thead>
              <tr className="giq-table-head">
                {[
                  "Date",
                  "Track",
                  "Dist",
                  "Box",
                  "Finish",
                  "Time",
                  "Grade",
                  "Wgt",
                  "1st Sec",
                  "Mgn",
                  "Winner / 2nd",
                  "Video",
                ].map((label, index) => (
                  <th
                    key={label}
                    className={`${index < 2 || index === 10 ? "text-left" : "text-center"} px-2 py-4 tracking-[0.04em]`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentForm.map((entry) => (
                <tr key={entry.id} className="giq-table-row h-[56px]">
                  <td className="px-2 py-3 text-[12px] tabular-nums text-[hsl(var(--muted-foreground))]">
                    {formatFormDate(entry.date)}
                  </td>
                  <td className="truncate px-2 py-3 text-[13px] font-medium text-[hsl(var(--foreground))]">
                    {entry.trackName}
                  </td>
                  <td className="px-2 py-3 text-center text-[12px] text-[hsl(var(--muted-foreground))]">
                    {formatDistance(entry.distance)}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <BoxPlate boxNumber={entry.boxNumber} />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <FinishBadge finish={entry.finish} />
                  </td>
                  <td className="px-2 py-3 text-center font-mono text-[12px] text-[hsl(var(--primary-bright))]">
                    {formatSeconds(entry.time)}
                  </td>
                  <td className="truncate px-2 py-3 text-center text-[12px] text-[hsl(var(--muted-foreground))]">
                    {entry.grade ?? "—"}
                  </td>
                  <td className="px-2 py-3 text-center text-[12px] text-[hsl(var(--muted-foreground))]">
                    {formatWeight(entry.weight)}
                  </td>
                  <td className="px-2 py-3 text-center text-[12px] tabular-nums text-[hsl(var(--muted-foreground))]">
                    {formatNumber(entry.firstSectional)}
                  </td>
                  <td className="px-2 py-3 text-center text-[12px] tabular-nums text-[hsl(var(--muted-foreground))]">
                    {formatNumber(entry.margin)}
                  </td>
                  <td className="truncate px-2 py-3 text-[12px] text-[hsl(var(--muted-foreground))]">
                    {entry.winnerDogName ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <ReplayLink href={entry.replayHref} compact />
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

function OwnershipBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="giq-status-pill giq-status-pill-purple">
        <BadgeCheck className="h-3.5 w-3.5" />
        Verified owner
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="giq-status-pill giq-status-pill-red">
        <Ban className="h-3.5 w-3.5" />
        Not approved
      </span>
    );
  }
  return (
    <span className="giq-status-pill giq-status-pill-gold">
      <Clock className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}

function formatPrize(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

type DogDetail = NonNullable<Awaited<ReturnType<typeof getDogById>>>;

type RecentFormRow = {
  id: string;
  date: Date;
  trackName: string;
  distance: number | null;
  boxNumber: number | null;
  finish: number | null;
  time: number | null;
  grade: string | null;
  weight: number | null;
  firstSectional: number | null;
  margin: number | null;
  winnerDogName: string | null;
  replayHref: string | null;
};

function buildRecentForm(dog: DogDetail): RecentFormRow[] {
  if (dog.profileForms.length > 0) {
    return dog.profileForms.map((entry) => {
      const formEntry = dog.formEntries.find(
        (candidate) =>
          sameRaceDay(candidate.date, entry.date) &&
          (!entry.distance || candidate.distance === entry.distance) &&
          (!entry.boxNumber || candidate.boxNumber === entry.boxNumber),
      );
      const runner = findMatchingRunner(dog, entry.date, null, entry.distance);

      return {
        id: entry.id,
        date: entry.date,
        trackName:
          entry.trackName ??
          runner?.race.meeting.track?.name ??
          formEntry?.track?.name ??
          entry.trackCode ??
          "—",
        distance: entry.distance ?? runner?.race.distance ?? formEntry?.distance ?? null,
        boxNumber: entry.boxNumber ?? runner?.boxNumber ?? formEntry?.boxNumber ?? null,
        finish:
          entry.finishingPosition ??
          runner?.result?.finishingPosition ??
          formEntry?.finish ??
          null,
        time: entry.runningTime ?? runner?.result?.runningTime ?? formEntry?.time ?? null,
        grade: entry.grade ?? runner?.race.grade ?? formEntry?.grade ?? null,
        weight: entry.weight ?? runner?.weight ?? formEntry?.weight ?? null,
        firstSectional: entry.firstSectional ?? runner?.result?.splitTime ?? null,
        margin: entry.margin ?? runner?.result?.margin ?? null,
        winnerDogName: entry.winnerDogName,
        replayHref:
          (runner?.race.replayUrl ? `/races/${runner.race.id}` : null) ??
          profileReplayHref(entry),
      };
    });
  }

  return dog.formEntries.slice(0, 20).map((entry) => {
    const runner = findMatchingRunner(dog, entry.date, entry.raceId, entry.distance);
    return {
      id: entry.id,
      date: entry.date,
      trackName: runner?.race.meeting.track?.name ?? entry.track?.name ?? "—",
      distance: entry.distance ?? runner?.race.distance ?? null,
      boxNumber: entry.boxNumber ?? runner?.boxNumber ?? null,
      finish: entry.finish ?? runner?.result?.finishingPosition ?? null,
      time: entry.time ?? runner?.result?.runningTime ?? null,
      grade: entry.grade ?? runner?.race.grade ?? null,
      weight: entry.weight ?? runner?.weight ?? null,
      firstSectional: runner?.result?.splitTime ?? null,
      margin: runner?.result?.margin ?? null,
      winnerDogName: null,
      replayHref: runner?.race.replayUrl ? `/races/${runner.race.id}` : null,
    };
  });
}

function findMatchingRunner(
  dog: DogDetail,
  date: Date,
  raceId: string | null,
  distance: number | null,
) {
  return dog.runners.find(
    (runner) =>
      (raceId != null && runner.race.id === raceId) ||
      (sameRaceDay(runner.race.raceTime, date) &&
        (distance == null || runner.race.distance === distance)),
  );
}

function profileReplayHref(entry: DogDetail["profileForms"][number]) {
  if (!entry.hasVideo || entry.sourceProvider.toLowerCase() !== "thedogs") return null;
  try {
    return absoluteTheDogsUrl(entry.raceUrl);
  } catch {
    return null;
  }
}

const raceDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function sameRaceDay(left: Date, right: Date) {
  return raceDayFormatter.format(left) === raceDayFormatter.format(right);
}

function formatFormDate(value: Date) {
  return value.toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney",
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function formatSeconds(value: number | null) {
  return value == null ? "—" : `${value.toFixed(2)}s`;
}

function formatDistance(value: number | null) {
  return value == null ? "—" : `${value}m`;
}

function formatWeight(value: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}kg`;
}

function formatNumber(value: number | null) {
  return value == null ? "—" : value.toFixed(2);
}

function FormSummaryValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="grid min-w-0 justify-items-center gap-1">
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </span>
      {children}
    </span>
  );
}

function FormDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-[13px] tabular-nums text-[hsl(var(--muted-foreground))]">
        {value}
      </dd>
    </div>
  );
}

function BoxPlate({ boxNumber }: { boxNumber: number | null }) {
  return boxNumber == null ? (
    <span className="text-[13px] text-[hsl(var(--muted-foreground))]">—</span>
  ) : (
    <span className="giq-box-plate" style={getBoxColourStyle(boxNumber)}>
      {boxNumber}
    </span>
  );
}

function ReplayLink({ href, compact = false }: { href: string | null; compact?: boolean }) {
  const size = compact ? "h-8 w-8" : "h-14 w-14";
  if (!href) {
    return (
      <span
        className={`inline-grid ${size} place-items-center rounded-full text-[hsl(var(--subtle-foreground))]`}
        aria-label="Race replay unavailable"
      >
        —
      </span>
    );
  }
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      aria-label="Play race replay"
      className={`inline-grid ${size} place-items-center rounded-full border border-[hsl(var(--primary-bright)/0.75)] text-[hsl(var(--primary-bright))] transition-colors hover:bg-[hsl(var(--primary)/0.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-bright))]`}
    >
      <Play className={compact ? "h-4 w-4 fill-current" : "h-6 w-6 fill-current"} aria-hidden="true" />
    </a>
  );
}

function formatRole(role: string) {
  return role
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}
