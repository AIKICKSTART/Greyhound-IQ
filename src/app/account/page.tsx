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

export default async function AccountPage() {
  const user = await getCurrentUser();

  return (
    <div className="fade-in">
      <PageHero
        image="/images/hero-greyhoundiq-brand.png"
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
        {!user ? <SignedOutAccount /> : <SignedInAccount user={user} />}
      </section>
    </div>
  );
}

async function SignedInAccount({
  user,
}: {
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
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="mb-5 flex items-center gap-3">
          <Pencil className="h-5 w-5 text-[hsl(142_60%_48%)]" />
          <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)]">
            Profile
          </h2>
        </div>
        <form action={updateProfile} className="grid gap-4">
          <label className="block">
            <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
              Display name
            </span>
            <input
              name="displayName"
              required
              minLength={2}
              maxLength={80}
              defaultValue={profile?.displayName ?? user.name}
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                State
              </span>
              <input
                name="state"
                maxLength={8}
                defaultValue={profile?.state ?? ""}
                className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
                placeholder="NSW"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                Phone
              </span>
              <input
                name="phone"
                maxLength={40}
                defaultValue={profile?.phone ?? ""}
                className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                Kennel
              </span>
              <input
                name="kennelName"
                maxLength={120}
                defaultValue={profile?.kennelName ?? ""}
                className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                Prefix
              </span>
              <input
                name="kennelPrefix"
                maxLength={40}
                defaultValue={profile?.kennelPrefix ?? ""}
                className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
              Website
            </span>
            <input
              name="website"
              type="url"
              maxLength={200}
              defaultValue={profile?.website ?? ""}
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
              placeholder="https://example.com"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
              Bio
            </span>
            <textarea
              name="bio"
              maxLength={1000}
              rows={4}
              defaultValue={profile?.bio ?? ""}
              className="mt-2 w-full resize-y rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] leading-relaxed text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4 text-[13px]">
            <div className="flex items-center gap-2 text-[hsl(215_14%_65%)]">
              <User className="h-3.5 w-3.5 text-[hsl(142_60%_48%)]" />
              <span>{user.email}</span>
            </div>
            <SubmitButton pendingLabel="Saving profile...">Save profile</SubmitButton>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="mb-5 flex items-center gap-3">
          <Crown className="h-5 w-5 text-[hsl(25_95%_53%)]" />
          <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)]">
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
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(142_76%_36%)] to-[hsl(142_60%_40%)] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:brightness-110"
          >
            Manage tier
          </Link>
          <Link
            href="/messages"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] font-semibold text-[hsl(210_13%_97%)] transition-all hover:bg-white/[0.06]"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Open messages
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 lg:col-span-2">
        <div className="mb-5 flex items-center gap-3">
          <PawPrint className="h-5 w-5 text-[hsl(142_60%_48%)]" />
          <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)]">
            Dogs
          </h2>
        </div>

        {ownedDogs.length > 0 ? (
          <div className="grid gap-3">
            {ownedDogs.map((ownership) => (
              <Link
                key={ownership.id}
                href={`/dogs/${ownership.dog.id}`}
                className="grid gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04] sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold text-[hsl(210_13%_97%)]">
                    {ownership.dog.name}
                  </p>
                  <p className="mt-1 text-[13px] text-[hsl(215_14%_65%)]">
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
          <div className="rounded-lg border border-dashed border-white/[0.12] p-5">
            <p className="text-[14px] text-[hsl(215_14%_65%)]">
              No dogs are linked to this profile yet.
            </p>
            <Link
              href="/dogs"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] font-semibold text-[hsl(210_13%_97%)] transition-all hover:bg-white/[0.06]"
            >
              <PawPrint className="h-3.5 w-3.5" />
              Search dogs
            </Link>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 lg:col-span-2">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[hsl(142_60%_48%)]" />
          <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)]">
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
                className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] font-semibold text-[hsl(210_13%_97%)] transition-all hover:bg-white/[0.06]"
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
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[hsl(25_95%_53%/0.35)] bg-[hsl(25_95%_53%/0.1)] px-3 py-1 text-[12px] font-semibold text-[hsl(25_95%_53%)]">
                  <Clock className="h-3.5 w-3.5" />
                  Requested
                </span>
              ) : (
                <form action={requestAccountDeletion}>
                  <SubmitButton
                    pendingLabel="Requesting..."
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-2 text-[13px] font-semibold text-red-200 transition-all hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
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

function SignedOutAccount() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8">
      <Lock className="mb-4 h-7 w-7 text-[hsl(142_60%_48%)]" />
      <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)]">
        Sign in to manage your account
      </h2>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[hsl(215_14%_65%)]">
        Account state is backed by the local user row created after the WorkOS
        AuthKit callback.
      </p>
      <Link
        href="/sign-in"
        className="mt-6 inline-flex rounded-lg bg-gradient-to-r from-[hsl(142_76%_36%)] to-[hsl(142_60%_40%)] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:brightness-110"
      >
        Sign in
      </Link>
    </div>
  );
}

function StatusBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold ${
        verified
          ? "border-[hsl(142_76%_36%/0.35)] bg-[hsl(142_76%_36%/0.12)] text-[hsl(142_60%_48%)]"
          : "border-[hsl(25_95%_53%/0.35)] bg-[hsl(25_95%_53%/0.1)] text-[hsl(25_95%_53%)]"
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
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[11px] font-semibold uppercase text-[hsl(220_7%_42%)]">
        {label}
      </p>
      <p className="mt-1 text-[20px] font-semibold text-[hsl(210_13%_97%)]">
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
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(142_76%_36%/0.12)] text-[hsl(142_60%_48%)]">
        {icon}
      </div>
      <h3 className="text-[14px] font-semibold text-[hsl(210_13%_97%)]">
        {title}
      </h3>
      <p className="mt-2 text-[12px] leading-relaxed text-[hsl(215_14%_65%)]">
        {body}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
