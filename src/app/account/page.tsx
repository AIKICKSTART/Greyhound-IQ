import Link from "next/link";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  Clock,
  Crown,
  Database,
  Lock,
  MessageSquare,
  PawPrint,
  Pencil,
  ShieldCheck,
  User,
} from "lucide-react";
import { requestAccountDeletion, updateProfile } from "@/app/actions";
import { PageHero } from "@/components/page-hero";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { getAccountSummary, getMessagesForUserEmail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account - GreyhoundIQ",
  description:
    "Manage your GreyhoundIQ account, subscription tier, profile, privacy, and message summary.",
};

const DEMO_ACCOUNT_ENABLED = demoAccountEnabled();
const PANEL_CLASS = "giq-panel p-6";
const INPUT_CLASS = "giq-form-control mt-2 px-3 py-2";
const TEXTAREA_CLASS = "giq-form-control giq-textarea mt-2 px-3 py-2";
const ACTION_CLASS = "giq-outline-action";
const PENDING_PLAN_LABELS = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro+",
} as const;

type PendingPlan = keyof typeof PENDING_PLAN_LABELS;

type AccountPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const user = await getCurrentUser();
  const pendingPlan = parsePendingPlan((await searchParams).plan);

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Your GreyhoundIQ
            <br />
            <span className="gradient-text">account.</span>
          </>
        }
        subtitle="Profile, tier, privacy, messaging, and account controls in one place."
      />

      <section className="mx-auto max-w-5xl px-6 py-12">
        {!user ? (
          <SignedOutAccount />
        ) : (
          <SignedInAccount user={user} pendingPlan={pendingPlan} />
        )}
      </section>
    </div>
  );
}

async function SignedInAccount({
  pendingPlan,
  user,
}: {
  pendingPlan: PendingPlan | null;
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
}) {
  const [summary, messages] = await Promise.all([
    getAccountSummary(user.email),
    getMessagesForUserEmail(user.email),
  ]);
  const profile = summary?.profile;
  const ownedDogs = profile?.dogsOwned ?? [];
  const deletionRequestedAt = user.deletionRequestedAt;

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className={PANEL_CLASS}>
        <div className="mb-5 flex items-center gap-3">
          <Pencil className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            Profile
          </h2>
        </div>
        <form action={updateProfile} className="grid gap-4">
          <label className="block">
            <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
              Display name
            </span>
            <input
              name="displayName"
              required
              minLength={2}
              maxLength={80}
              defaultValue={profile?.displayName ?? user.name}
              className={INPUT_CLASS}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                State
              </span>
              <input
                name="state"
                maxLength={8}
                defaultValue={profile?.state ?? ""}
                className={INPUT_CLASS}
                placeholder="NSW"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                Phone
              </span>
              <input
                name="phone"
                maxLength={40}
                defaultValue={profile?.phone ?? ""}
                className={INPUT_CLASS}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                Kennel
              </span>
              <input
                name="kennelName"
                maxLength={120}
                defaultValue={profile?.kennelName ?? ""}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                Prefix
              </span>
              <input
                name="kennelPrefix"
                maxLength={40}
                defaultValue={profile?.kennelPrefix ?? ""}
                className={INPUT_CLASS}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
              Website
            </span>
            <input
              name="website"
              type="url"
              maxLength={200}
              defaultValue={profile?.website ?? ""}
              className={INPUT_CLASS}
              placeholder="https://example.com"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
              Bio
            </span>
            <textarea
              name="bio"
              maxLength={1000}
              rows={4}
              defaultValue={profile?.bio ?? ""}
              className={TEXTAREA_CLASS}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4 text-[13px]">
            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
              <User className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))]" />
              <span>{user.email}</span>
            </div>
            <SubmitButton pendingLabel="Saving profile...">Save profile</SubmitButton>
          </div>
        </form>
      </section>

      <section className={PANEL_CLASS}>
        <div className="mb-5 flex items-center gap-3">
          <Crown className="h-5 w-5 text-[hsl(var(--secondary))]" />
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            Subscription and activity
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric
            label="Tier"
            value={user.tier === "pro_plus" ? "Pro+" : user.tier}
          />
          <Metric label="Messages" value={messages.length} />
          <Metric label="Listings" value={profile?._count.listings ?? 0} />
          <Metric label="Owned dogs" value={profile?._count.dogsOwned ?? 0} />
        </div>
        {pendingPlan && <PendingPlanBanner plan={pendingPlan} />}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="giq-liquid-purple-button min-h-10 px-4 text-[13px] font-semibold"
          >
            Manage tier
          </Link>
          <Link
            href="/messages"
            className={ACTION_CLASS}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Open messages
          </Link>
        </div>
      </section>

      <section className={`${PANEL_CLASS} lg:col-span-2`}>
        <div className="mb-5 flex items-center gap-3">
          <PawPrint className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            Dogs
          </h2>
        </div>

        {ownedDogs.length > 0 ? (
          <div className="grid gap-3">
            {ownedDogs.map((ownership) => (
              <Link
                key={ownership.id}
                href={`/dogs/${ownership.dog.id}`}
                className="giq-subpanel grid gap-3 p-4 transition-colors hover:bg-white/[0.04] sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">
                    {ownership.dog.name}
                  </p>
                  <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                    {formatRole(ownership.role)}
                    {ownership.dog.sex ? ` · ${ownership.dog.sex}` : ""}
                    {ownership.dog.colour ? ` · ${ownership.dog.colour}` : ""}
                  </p>
                </div>
                <StatusBadge verified={ownership.verified} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="giq-dashed-panel p-5">
            <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
              No dogs are linked to this profile yet.
            </p>
            <Link
              href="/dogs"
              className={`${ACTION_CLASS} mt-4`}
            >
              <PawPrint className="h-3.5 w-3.5" />
              Search dogs
            </Link>
          </div>
        )}
      </section>

      <section className={`${PANEL_CLASS} lg:col-span-2`}>
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            Privacy controls
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ControlCard
            icon={<Database className="h-4 w-4" />}
            title="Data export"
            body="Download a JSON archive of your profile, content, messages, listings, ownership links, and agent runs."
            action={
              <Link
                href="/api/users/me/export"
                className={ACTION_CLASS}
              >
                Download JSON
              </Link>
            }
          />
          <ControlCard
            icon={<Lock className="h-4 w-4" />}
            title="Account deletion"
            body={
              deletionRequestedAt
                ? `Deletion requested ${deletionRequestedAt.toLocaleDateString("en-AU")}.`
                : "Request account deletion with a 30-day grace window before hard deletion processing."
            }
            action={
              deletionRequestedAt ? (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[hsl(var(--secondary)/0.35)] bg-[hsl(var(--secondary)/0.1)] px-3 py-1 text-[12px] font-semibold text-[hsl(var(--secondary))]">
                  <Clock className="h-3.5 w-3.5" />
                  Requested
                </span>
              ) : (
                <form action={requestAccountDeletion}>
                  <SubmitButton
                    pendingLabel="Requesting..."
                    className="giq-danger-action disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Request deletion
                  </SubmitButton>
                </form>
              )
            }
          />
          <ControlCard
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Audit trail"
            body="Data export and deletion requests now write append-only AuditLog entries."
          />
        </div>
      </section>
    </div>
  );
}

function PendingPlanBanner({ plan }: { plan: PendingPlan }) {
  return (
    <div className="mt-4 rounded-lg border border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.08)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[hsl(var(--primary-bright))]">
            Plan intent received
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            You selected {PENDING_PLAN_LABELS[plan]} before sign-in. This query
            flag is only intent; your active tier stays unchanged until a plan
            change is completed.
          </p>
        </div>
        <Link
          href="/pricing"
          className={`${ACTION_CLASS} shrink-0`}
        >
          Review plans
        </Link>
      </div>
    </div>
  );
}

function SignedOutAccount() {
  return (
    <div className="grid gap-6">
      <div className="giq-panel p-8">
        <Lock className="mb-4 h-7 w-7 text-[hsl(var(--primary-bright))]" />
        <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
          Sign in to manage your account
        </h2>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Account state is backed by the local user row created after the WorkOS
          AuthKit callback.
        </p>
        <Link
          href="/sign-in"
          className="giq-liquid-purple-button mt-6 px-5 text-[13px] font-semibold"
        >
          Sign in
        </Link>
      </div>
      {DEMO_ACCOUNT_ENABLED && <DemoAccountPreview />}
    </div>
  );
}

function DemoAccountPreview() {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className={PANEL_CLASS}>
        <div className="mb-5 flex items-center gap-3">
          <User className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            Demo profile
          </h2>
        </div>
        <div className="space-y-3 text-[14px] text-[hsl(var(--muted-foreground))]">
          <InfoRow label="Name" value="South Coast Syndicate" />
          <InfoRow label="State" value="NSW" />
          <InfoRow label="Kennel" value="Harbourline Kennels" />
          <InfoRow label="Role" value="Owner / breeder" />
        </div>
      </section>

      <section className={PANEL_CLASS}>
        <div className="mb-5 flex items-center gap-3">
          <Crown className="h-5 w-5 text-[hsl(var(--secondary))]" />
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            Demo activity
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Tier" value="Pro+" />
          <Metric label="Messages" value={8} />
          <Metric label="Listings" value={5} />
          <Metric label="Owned dogs" value={3} />
        </div>
      </section>

      <section className={`${PANEL_CLASS} lg:col-span-2`}>
        <div className="mb-5 flex items-center gap-3">
          <PawPrint className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            Demo kennel
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {([
            ["Jetstream Juno", "Owner", true],
            ["Cobalt Ace", "Syndicate", true],
            ["Harbour Mist", "Breeder", false],
          ] as const).map(([name, role, verified]) => (
            <div
              key={name}
              className="giq-subpanel p-4"
            >
              <p className="font-semibold text-[hsl(var(--foreground))]">{name}</p>
              <p className="mb-3 mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                {role}
              </p>
              <StatusBadge verified={Boolean(verified)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`giq-status-pill ${
        verified
          ? "giq-status-pill-purple"
          : "giq-status-pill-gold"
      }`}
    >
      {verified ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
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

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="giq-metric-card">
      <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
        {label}
      </p>
      <p className="mt-1 text-[20px] font-semibold text-[hsl(var(--foreground))]">
        {value}
      </p>
    </div>
  );
}

function ControlCard({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="giq-subpanel p-4">
      <div className="giq-icon-plate mb-3 flex h-8 w-8 items-center justify-center rounded-md">
        {icon}
      </div>
      <h3 className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
        {title}
      </h3>
      <p className="mt-2 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        {body}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
      <span className="text-[hsl(var(--subtle-foreground))]">{label}</span>
      <span className="text-right font-semibold text-[hsl(var(--foreground))]">
        {value}
      </span>
    </div>
  );
}

function parsePendingPlan(value: string | string[] | undefined) {
  if (typeof value !== "string") return null;
  return value in PENDING_PLAN_LABELS ? (value as PendingPlan) : null;
}

function demoAccountEnabled() {
  const raw = process.env.NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT;
  if (!raw) return true;
  return !["0", "false", "off", "no"].includes(raw.trim().toLowerCase());
}
