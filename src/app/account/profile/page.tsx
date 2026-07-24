import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Columns3,
  ImageIcon,
  LayoutPanelLeft,
  PanelsTopLeft,
  ShieldCheck,
} from "lucide-react";

import {
  claimTrainerIdentity,
  updatePersonalIdentityMedia,
} from "@/app/actions";
import { updateMessengerLayoutPreference } from "@/app/account/profile/actions";
import { MediaAlignmentUpload } from "@/components/media-alignment-upload";
import { PageTitle } from "@/components/page-title";
import { ProfileMediaStatus } from "@/components/profile-media-status";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser, requireCurrentUserProfile } from "@/lib/auth";
import { MESSENGER_LAYOUT_OPTIONS } from "@/lib/messenger-layout";
import { withDbRequestContext } from "@/lib/db-context";
import { getPersonalActorMedia } from "@/lib/social-actor-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile Studio - GreyhoundIQ",
  description: "Position and publish your GreyhoundIQ profile photo and cover.",
};

export default async function ProfileStudioPage() {
  if (!(await getCurrentUser())) redirect("/sign-in?returnTo=/account/profile");
  const current = await requireCurrentUserProfile();
  const [media, trainerClaims] = await Promise.all([
    getPersonalActorMedia(current),
    withDbRequestContext(current, (tx) =>
      tx.trainerClaim.findMany({
        where: { profileId: current.profileId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          sourceProvider: true,
          sourceId: true,
          createdAt: true,
          rejectionReason: true,
          trainer: { select: { name: true } },
        },
      }),
    ),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-3 py-5 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/account" aria-label="Back to account" className="giq-outline-action h-11 w-11 justify-center px-0">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div>
            <PageTitle size="compact">
              Profile Studio
            </PageTitle>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
              Customise your public profile. Your current images stay live until replacements pass safety processing.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-[11px] text-emerald-100">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Private safety pipeline
        </span>
      </div>

      <section id="messenger-layout" className="giq-panel mb-5 scroll-mt-24 p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <PanelsTopLeft
            className="mt-0.5 h-5 w-5 text-[hsl(var(--primary-bright))]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
              Messenger layout
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Choose how Pulse opens on desktop. Every option uses the same full-screen inbox and conversation flow on mobile.
            </p>
          </div>
        </div>

        <form action={updateMessengerLayoutPreference}>
          <fieldset className="grid gap-3 lg:grid-cols-3">
            <legend className="sr-only">Choose your Messenger layout</legend>
            {MESSENGER_LAYOUT_OPTIONS.map((option, index) => {
              const Icon = index === 0 ? PanelsTopLeft : index === 1 ? Columns3 : LayoutPanelLeft;
              return (
                <label key={option.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="messengerLayout"
                    value={option.value}
                    defaultChecked={current.messengerLayout === option.value}
                    className="peer sr-only"
                    required
                  />
                  <span className="giq-messenger-layout-choice flex min-h-[156px] flex-col rounded-xl border border-white/[0.1] bg-white/[0.025] p-4 transition peer-checked:border-[hsl(var(--primary-light)/0.72)] peer-checked:bg-[hsl(var(--primary)/0.1)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[hsl(var(--primary-bright))]">
                    <span className="mb-3 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
                      <strong className="text-[13px] text-[hsl(var(--foreground))]">
                        {option.label}
                      </strong>
                    </span>
                    <span className="giq-messenger-layout-preview mb-3" data-layout={option.value} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
            <p className="text-[11px] text-[hsl(var(--subtle-foreground))]">
              Your choice follows your account on every signed-in desktop browser.
            </p>
            <SubmitButton
              pendingLabel="Saving layout..."
              className="giq-button giq-button-primary min-h-11 px-5 text-[13px] font-semibold disabled:cursor-not-allowed"
            >
              Save Messenger layout
            </SubmitButton>
          </div>
        </form>
      </section>

      <section id="trainer-claim" className="giq-panel mb-5 scroll-mt-24 p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <BadgeCheck
            className="mt-0.5 h-5 w-5 text-[hsl(var(--secondary-light))]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
              Claim your trainer identity
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Link your verified provider trainer record to My Race Day. Claims
              are checked by a moderator and never matched from a name alone.
            </p>
          </div>
        </div>

        <form action={claimTrainerIdentity} className="grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
            Official provider
            <select
              name="sourceProvider"
              className="giq-form-control min-h-11 px-3"
              defaultValue="thedogs"
              required
            >
              <option value="thedogs">The Dogs</option>
              <option value="watchdog">Watchdog</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
            Provider trainer ID
            <input
              name="sourceId"
              className="giq-form-control min-h-11 px-3"
              maxLength={256}
              placeholder="For example 10792"
              required
            />
          </label>
          <label className="grid gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))] lg:col-span-2">
            Official trainer profile URL
            <input
              name="officialProfileUrl"
              className="giq-form-control min-h-11 px-3"
              type="url"
              maxLength={2048}
              placeholder="Required for The Dogs claims"
            />
          </label>
          <label className="grid gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))] lg:col-span-2">
            Evidence for the moderator
            <textarea
              name="evidence"
              className="giq-form-control min-h-24 px-3 py-2"
              minLength={10}
              maxLength={1000}
              placeholder="Explain your connection to this trainer identity."
              required
            />
          </label>
          <div className="flex justify-end lg:col-span-2">
            <SubmitButton
              pendingLabel="Submitting claim..."
              className="giq-button giq-button-gold min-h-11 px-5 text-[13px] font-semibold disabled:cursor-not-allowed"
            >
              Submit trainer claim
            </SubmitButton>
          </div>
        </form>

        {trainerClaims.length > 0 ? (
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
              Your trainer claims
            </p>
            <div className="grid gap-2">
              {trainerClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2"
                >
                  <span className="text-[13px] text-[hsl(var(--foreground))]">
                    {claim.trainer.name}
                    <small className="ml-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                      {claim.sourceProvider}:{claim.sourceId}
                    </small>
                  </span>
                  <span className="giq-badge giq-badge-neutral">
                    {claim.status}
                  </span>
                  {claim.rejectionReason ? (
                    <p className="w-full text-[11px] text-rose-200">
                      {claim.rejectionReason}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <form action={updatePersonalIdentityMedia} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <input type="hidden" name="avatarMediaId" value={media.avatarMediaId ?? ""} />
        <input type="hidden" name="coverMediaId" value={media.coverMediaId ?? ""} />

        <fieldset id="cover-image-editor" className="giq-panel min-w-0 scroll-mt-24 p-4 sm:p-5 lg:row-span-2">
          <legend className="px-2 text-[12px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
            Cover
          </legend>
          <div className="mb-4 flex items-start gap-3">
            <ImageIcon className="mt-0.5 h-5 w-5 text-[hsl(var(--secondary))]" aria-hidden="true" />
            <div>
              <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">Live cover preview</h2>
              <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">Drag, zoom, rotate, and check both desktop and mobile safe zones.</p>
            </div>
          </div>
          <MediaAlignmentUpload
            currentSrc={media.coverUrl ?? "/images/wentworth-track-banner-landscape.webp"}
            alt="Cover alignment preview"
            shape="banner"
            mediaContext="avatars"
            fieldName="coverMediaIdNew"
            xName="coverFocalX"
            yName="coverFocalY"
            zoomName="coverZoom"
            rotationName="coverRotation"
            defaultX={media.coverFocalX}
            defaultY={media.coverFocalY}
            defaultZoom={media.coverZoom}
            defaultRotation={media.coverRotation}
          />
          <ProfileMediaStatus label="Cover" initial={media.pendingCover} />
          {media.coverUrl ? (
            <label className="mt-3 flex min-h-11 items-center gap-2 text-[12px] text-[hsl(var(--muted-foreground))]">
              <input type="checkbox" name="removeCover" value="true" /> Remove current cover
            </label>
          ) : null}
        </fieldset>

        <fieldset id="profile-picture-editor" className="giq-panel scroll-mt-24 p-4 sm:p-5">
          <legend className="px-2 text-[12px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
            Profile photo
          </legend>
          <div className="mb-4 flex items-start gap-3">
            <Camera className="mt-0.5 h-5 w-5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
            <div>
              <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">300px circular editor</h2>
              <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">Use arrow keys for precise nudging; hold Shift for larger steps.</p>
            </div>
          </div>
          <MediaAlignmentUpload
            currentSrc={media.avatarUrl}
            alt="Profile photo alignment preview"
            shape="circle"
            mediaContext="avatars"
            fieldName="avatarMediaIdNew"
            xName="avatarFocalX"
            yName="avatarFocalY"
            zoomName="avatarZoom"
            rotationName="avatarRotation"
            defaultX={media.avatarFocalX}
            defaultY={media.avatarFocalY}
            defaultZoom={media.avatarZoom}
            defaultRotation={media.avatarRotation}
          />
          <ProfileMediaStatus label="Profile photo" initial={media.pendingAvatar} />
          {media.avatarUrl ? (
            <label className="mt-3 flex min-h-11 items-center gap-2 text-[12px] text-[hsl(var(--muted-foreground))]">
              <input type="checkbox" name="removeAvatar" value="true" /> Remove current profile photo
            </label>
          ) : null}
        </fieldset>

        <div className="giq-panel flex flex-wrap items-center justify-end gap-3 p-4">
          <Link href="/account" className="giq-button giq-button-carbon min-h-11 px-5 text-[13px] font-semibold">
            Cancel
          </Link>
          <SubmitButton pendingLabel="Publishing..." className="giq-button giq-button-gold min-h-11 px-5 text-[13px] font-semibold disabled:cursor-not-allowed">
            Publish profile
          </SubmitButton>
        </div>
      </form>
    </main>
  );
}
