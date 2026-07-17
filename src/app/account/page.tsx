import Link from "next/link";
import type { ReactNode } from "react";
import {
  Camera,
  CheckCircle2,
  Clock,
  Crown,
  Database,
  Lock,
  MessageSquare,
  ShoppingBag,
  PawPrint,
  Pencil,
  Bookmark,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import {
  requestAccountDeletion,
  updateProfile,
} from "@/app/actions";
import { ActorMediaImage } from "@/components/actor-media-image";
import { PageHero } from "@/components/page-hero";
import { PageTitle } from "@/components/page-title";
import { SubmitButton } from "@/components/submit-button";
import { UserDataExportForm } from "@/components/user-data-export-form";
import { getCurrentUser, hasTier, isModeratorRole } from "@/lib/auth";
import { getAccountSummary, getMessagesForUserEmail } from "@/lib/queries";
import { getPersonalActorMedia } from "@/lib/social-actor-service";
import { isFullAccessDemo } from "@/lib/demo-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account - GreyhoundIQ",
  description:
    "Manage your GreyhoundIQ account, subscription tier, profile, privacy, and message summary.",
};

const DEMO_ACCOUNT_ENABLED = demoAccountEnabled();
const PANEL_CLASS = "giq-panel p-5 sm:p-6";
const INPUT_CLASS = "giq-form-control mt-2 min-h-11 px-3 py-2.5";
const TEXTAREA_CLASS =
  "giq-form-control giq-textarea mt-2 min-h-32 px-3 py-2.5";
const ACTION_CLASS =
  "giq-outline-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]";
const PENDING_PLAN_LABELS = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro+",
} as const;

type PendingPlan = keyof typeof PENDING_PLAN_LABELS;
type PendingInterval = "monthly" | "yearly";

type AccountPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const user = await getCurrentUser();
  const query = await searchParams;
  const pendingPlan = parsePendingPlan(query.plan);
  const pendingInterval =
    pendingPlan === "pro" && query.checkout === "continue"
      ? parsePendingInterval(query.interval)
      : null;

  return (
    <div>
      {user ? (
        <AccountMemberHeader tier={user.tier} />
      ) : (
        <PageHero
          image="/images/feed/founder-race-night-cover.webp"
          title={
            <>
              Your GreyhoundIQ
              <br />
              <span className="gradient-text">account.</span>
            </>
          }
          subtitle="Profile, tier, privacy, messaging, and account controls in one place."
        />
      )}

      <section
        className={
          user
            ? "mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
            : "mx-auto max-w-5xl px-6 py-12"
        }
      >
        {!user ? (
          <SignedOutAccount
            returnTo={accountReturnTo(pendingPlan, pendingInterval)}
          />
        ) : (
          <SignedInAccount
            user={user}
            pendingPlan={pendingPlan}
            pendingInterval={pendingInterval}
          />
        )}
      </section>
    </div>
  );
}

function AccountMemberHeader({ tier }: { tier: "free" | "pro" | "pro_plus" }) {
  return (
    <header className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
        <div className="max-w-2xl">
          <p className="program-label">Member settings</p>
          <PageTitle className="mt-2">
            Account
          </PageTitle>
          <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
            Manage your profile, identity, privacy, and membership.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="giq-status-pill giq-status-pill-purple min-h-8 px-3">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            {tier === "pro_plus" ? "Pro+" : tier === "pro" ? "Pro" : "Free"}
          </span>
          <Link href="/feed" className={ACTION_CLASS}>
            Back to Feed
          </Link>
        </div>
      </div>
    </header>
  );
}

async function SignedInAccount({
  pendingInterval,
  pendingPlan,
  user,
}: {
  pendingInterval: PendingInterval | null;
  pendingPlan: PendingPlan | null;
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
}) {
  const dbContext = user.dbUserId
    ? {
        dbUserId: user.dbUserId,
        profileId: user.profileId ?? user.dbUserId,
        profileRole: user.role ?? "member",
        tier: user.tier,
      }
    : null;
  const [summary, messages] = dbContext
    ? await Promise.all([
        getAccountSummary(dbContext, user.email),
        getMessagesForUserEmail(dbContext, user.email),
      ])
    : [null, []];
  const profile = summary?.profile;
  const displayName = isFullAccessDemo()
    ? user.name
    : profile?.displayName ?? user.name;
  const personalMedia =
    user.dbUserId && user.profileId
      ? await getPersonalActorMedia({
          id: user.id,
          dbUserId: user.dbUserId,
          profileId: user.profileId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          profileRole: user.role ?? "member",
          role: user.role,
          tier: user.tier,
          isBanned: user.isBanned,
          deletionRequestedAt: user.deletionRequestedAt,
          displayName,
          verified: profile?.verified ?? false,
        })
      : null;
  const profileAvatarUrl = personalMedia?.avatarUrl ?? profile?.avatarUrl ?? null;
  const ownedDogs = profile?.dogsOwned ?? [];
  const deletionRequestedAt = user.deletionRequestedAt;
  const canAccessAdmin = isModeratorRole(user.role);
  const canEditMarketingProfile = hasTier(user.tier, "pro");

  return (
    <div className="grid gap-5 sm:gap-6 lg:grid-cols-12">
      <AccountMutationFeedback />
      <section id="profile-media" className={`${PANEL_CLASS} scroll-mt-24 lg:col-span-12`}>
        <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-[hsl(var(--surface-1))] bg-[hsl(var(--surface-2))] shadow-xl">
              {profileAvatarUrl ? (
                <ActorMediaImage
                  src={profileAvatarUrl}
                  alt=""
                  fill
                  sizes="192px"
                  focalX={personalMedia?.avatarFocalX}
                  focalY={personalMedia?.avatarFocalY}
                  zoom={personalMedia?.avatarZoom}
                  rotation={personalMedia?.avatarRotation}
                />
              ) : (
                <div className="grid h-full place-items-center text-2xl font-semibold text-white/75">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
                <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
                  Profile media
                </h2>
              </div>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                Position your photo and cover, preview mobile safe zones, then publish both from the dedicated studio.
              </p>
            </div>
          </div>
          <Link href="/account/profile" className="giq-button giq-button-gold min-h-11 px-5 text-[13px] font-semibold">
            Open Profile Studio
          </Link>
        </div>
      </section>

      <section className={`${PANEL_CLASS} lg:col-span-7`}>
        <div className="mb-5 flex items-center gap-3">
          <Pencil className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
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
              defaultValue={displayName}
              className={INPUT_CLASS}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                Profile audience
              </span>
              <select
                name="profileVisibility"
                defaultValue={profile?.socialActor?.profileVisibility ?? "members"}
                className={INPUT_CLASS}
              >
                <option value="public">Public</option>
                <option value="members">Members</option>
                <option value="connections">Connections</option>
                <option value="only_me">Only me</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                Contact audience
              </span>
              <select
                name="contactVisibility"
                defaultValue={profile?.socialActor?.contactVisibility ?? "only_me"}
                className={INPUT_CLASS}
              >
                <option value="only_me">Only me</option>
                <option value="connections">Connections</option>
                <option value="members">Members</option>
                <option value="public">Public</option>
              </select>
            </label>
          </div>

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

          {canEditMarketingProfile ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
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
              <Link
                href="/account/pages"
                className="giq-outline-action mt-2 w-fit text-[12px]"
              >
                Manage my pages →
              </Link>
            </>
          ) : (
            <div className="rounded-lg border border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.08)] p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[hsl(var(--foreground))]">
                <Lock className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))]" />
                Pro profile tools
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                Custom trainer, punter, business, and dog marketing profile
                tools are included with Pro.
              </p>
              <Link
                href="/pricing"
                className="giq-outline-action mt-3 w-fit text-[12px]"
              >
                View Pro
              </Link>
            </div>
          )}

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

      <section className={`${PANEL_CLASS} lg:col-span-5`}>
        <div className="mb-5 flex items-center gap-3">
          <Crown className="h-5 w-5 text-[hsl(var(--secondary))]" />
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
            Subscription and activity
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric
            label="Tier"
            value={user.tier === "pro_plus" ? "Pro+" : user.tier}
          />
          <Metric label="Pulse" value={messages.length} />
          <Metric label="Marketplace" value={profile?._count.listings ?? 0} />
          <Metric label="Saved" value={profile?._count.savedListings ?? 0} />
          <Metric label="Owned dogs" value={profile?._count.dogsOwned ?? 0} />
        </div>
        {pendingPlan && (
          <PendingPlanBanner interval={pendingInterval} plan={pendingPlan} />
        )}
        <div className="mt-5 grid gap-4">
          <ActionGroup label="Membership">
            <Link
              href="/pricing"
              className="giq-liquid-purple-button min-h-11 px-4 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
            >
              Manage tier
            </Link>
            <Link href="/account/billing" className={ACTION_CLASS}>
              <Crown className="h-3.5 w-3.5" />
              Billing
            </Link>
            <Link href="/account/usage" className={ACTION_CLASS}>
              <Database className="h-3.5 w-3.5" />
              Usage
            </Link>
          </ActionGroup>
          <ActionGroup label="Settings">
            <Link href="/account/privacy" className={ACTION_CLASS}>
              <Lock className="h-3.5 w-3.5" />
              Privacy
            </Link>
            <Link href="/account/security" className={ACTION_CLASS}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Security
            </Link>
            <Link href="/account/notifications" className={ACTION_CLASS}>
              <MessageSquare className="h-3.5 w-3.5" />
              Notifications
            </Link>
          </ActionGroup>
          <ActionGroup label="Activity and support">
            <Link href="/pulse" className={ACTION_CLASS}>
              <MessageSquare className="h-3.5 w-3.5" />
              Open Pulse
            </Link>
            <Link href="/account/saved-listings" className={ACTION_CLASS}>
              <Bookmark className="h-3.5 w-3.5" />
              Saved marketplace
            </Link>
            <Link href="/account/listings" className={ACTION_CLASS}>
              <ShoppingBag className="h-3.5 w-3.5" />
              My listings
            </Link>
            <Link href="/account/team" className={ACTION_CLASS}>
              <Users className="h-3.5 w-3.5" />
              Team
            </Link>
            <Link href="/account/support" className={ACTION_CLASS}>
              <MessageSquare className="h-3.5 w-3.5" />
              Support
            </Link>
            {canAccessAdmin ? (
              <Link href="/admin" className={ACTION_CLASS}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Link>
            ) : null}
          </ActionGroup>
        </div>
      </section>

      <section className={`${PANEL_CLASS} lg:col-span-12`}>
        <div className="mb-5 flex items-center gap-3">
          <PawPrint className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
            Dogs
          </h2>
        </div>

        {ownedDogs.length > 0 ? (
          <div className="grid gap-3">
            {ownedDogs.map((ownership) => (
              <Link
                key={ownership.id}
                href={`/dogs/${ownership.dog.id}`}
                className="giq-subpanel grid min-h-16 gap-3 p-4 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] sm:grid-cols-[1fr_auto] sm:items-center"
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

      <section className={`${PANEL_CLASS} lg:col-span-12`}>
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
            Privacy controls
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ControlCard
            icon={<Database className="h-4 w-4" />}
            title="Data export"
            body="Download a JSON archive of your profile, content, Pulse messages, marketplace items, ownership links, and agent runs."
            action={
              <UserDataExportForm
                className={ACTION_CLASS}
                label="Download JSON"
              />
            }
          />
          <ControlCard
            icon={<Lock className="h-4 w-4" />}
            title="Account deletion"
            body={
              deletionRequestedAt
                ? `Deletion requested ${deletionRequestedAt.toLocaleDateString("en-AU")}.`
                : "Request account deletion with a 30-day grace window. Profile data is then de-identified and storage removal is queued; provider and backup retention may take longer."
            }
            action={
              deletionRequestedAt ? (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[hsl(var(--secondary)/0.35)] bg-[hsl(var(--secondary)/0.1)] px-3 py-1 text-[12px] font-semibold text-[hsl(var(--secondary))]">
                  <Clock className="h-3.5 w-3.5" />
                  Requested
                </span>
              ) : (
                <form action={requestAccountDeletion} className="grid gap-2">
                  <label className="text-[12px] font-semibold text-[hsl(var(--foreground))]">
                    Type DELETE to confirm
                    <input
                      name="confirmation"
                      type="text"
                      autoComplete="off"
                      required
                      pattern="DELETE"
                      spellCheck={false}
                      className={`${INPUT_CLASS} w-full`}
                    />
                  </label>
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

function AccountMutationFeedback() {
  const outcomes = [
    {
      id: "profile-updated",
      role: "status" as const,
      message: "Profile saved.",
      recovery: false,
    },
    {
      id: "profile-error",
      role: "alert" as const,
      message: "Profile could not be saved. Review the fields and try again.",
      recovery: true,
    },
    {
      id: "deletion-requested",
      role: "status" as const,
      message: "Account deletion requested. The 30-day grace window has started.",
      recovery: false,
    },
    {
      id: "deletion-error",
      role: "alert" as const,
      message: "Deletion could not be requested. Confirm DELETE and try again.",
      recovery: true,
    },
  ];

  return outcomes.map(({ id, message, recovery, role }) => (
    <div
      key={id}
      id={id}
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      aria-atomic="true"
      className={`hidden rounded-lg border p-4 target:block lg:col-span-12 ${
        recovery
          ? "border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.08)]"
          : "border-[hsl(var(--secondary)/0.35)] bg-[hsl(var(--secondary)/0.08)]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
          {message}
        </p>
        <Link href="/account" className={ACTION_CLASS}>
          Dismiss
        </Link>
      </div>
    </div>
  ));
}

function PendingPlanBanner({
  interval,
  plan,
}: {
  interval: PendingInterval | null;
  plan: PendingPlan;
}) {
  const checkoutReady = plan === "pro" && interval;

  return (
    <div
      aria-live="polite"
      className="mt-4 rounded-lg border border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.08)] p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[hsl(var(--primary-bright))]">
            {checkoutReady ? "Checkout ready" : "Plan intent received"}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            You selected {PENDING_PLAN_LABELS[plan]}
            {checkoutReady ? ` billed ${interval}` : ""} before sign-in. Your
            active tier stays unchanged until Stripe confirms a completed
            checkout.
          </p>
        </div>
        {checkoutReady ? (
          <form action="/api/billing/checkout" method="post" className="shrink-0">
            <input name="plan" type="hidden" value="pro" />
            <input name="interval" type="hidden" value={interval} />
            <SubmitButton
              pendingLabel="Opening Stripe..."
              className="giq-liquid-purple-button min-h-11 px-4 text-[13px] font-semibold"
            >
              Continue to secure checkout
            </SubmitButton>
          </form>
        ) : (
          <Link href="/pricing" className={`${ACTION_CLASS} shrink-0`}>
            Review plans
          </Link>
        )}
      </div>
      {checkoutReady ? (
        <p className="mt-3 text-[12px] text-[hsl(var(--subtle-foreground))]">
          This button opens Stripe Checkout. Signing in never starts a payment.
        </p>
      ) : null}
    </div>
  );
}

function SignedOutAccount({ returnTo }: { returnTo: string }) {
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
        <a
          href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
          className="giq-liquid-purple-button mt-6 px-5 text-[13px] font-semibold"
        >
          Sign in
        </a>
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
          <Metric label="Pulse" value={8} />
          <Metric label="Marketplace" value={5} />
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

function ActionGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
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
    <div className="giq-subpanel flex h-full flex-col p-4 sm:p-5">
      <div className="giq-icon-plate mb-3 flex h-8 w-8 items-center justify-center rounded-md">
        {icon}
      </div>
      <h3 className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
        {title}
      </h3>
      <p className="mt-2 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        {body}
      </p>
      {action ? <div className="mt-auto pt-4">{action}</div> : null}
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

function parsePendingInterval(
  value: string | string[] | undefined
): PendingInterval | null {
  return value === "monthly" || value === "yearly" ? value : null;
}

function accountReturnTo(
  plan: PendingPlan | null,
  interval: PendingInterval | null
) {
  if (!plan) return "/account";
  const params = new URLSearchParams({ plan });
  if (plan === "pro" && interval) {
    params.set("interval", interval);
    params.set("checkout", "continue");
  }
  return `/account?${params.toString()}`;
}

function demoAccountEnabled() {
  const raw = process.env.NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT;
  if (!raw) return true;
  return !["0", "false", "off", "no"].includes(raw.trim().toLowerCase());
}
