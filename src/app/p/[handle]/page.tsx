import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Globe, Mail, Phone, Trophy, DollarSign } from "lucide-react";
import {
  getPublishedCustomPageByHandle,
  resolveCustomPageMedia,
  CUSTOM_PAGE_TYPE_LABELS,
  type PublicCustomPage,
} from "@/lib/custom-page-service";
import { getDogPrizeMoney, getActiveListingsForProfile } from "@/lib/queries";
import { mediaDeliveryUrl } from "@/lib/media-service";
import { FinishBadge } from "@/components/finish-badge";

export const dynamic = "force-dynamic";

const BRAND_PURPLE = "#A127CE";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const page = await getPublishedCustomPageByHandle(handle);
  if (!page) {
    return { title: "Page not found - GreyhoundsIQ" };
  }
  const label = CUSTOM_PAGE_TYPE_LABELS[page.pageType as keyof typeof CUSTOM_PAGE_TYPE_LABELS];
  const title = `${page.title} — ${label} | GreyhoundsIQ`;
  const description = page.tagline ?? page.about?.slice(0, 155) ?? `${page.title} on GreyhoundsIQ.`;
  return {
    title,
    description,
    alternates: { canonical: `/p/${handle}` },
    openGraph: { title, description, url: `/p/${handle}`, type: "profile" },
  };
}

function money(value: number | null | undefined) {
  if (value == null) return null;
  return value.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

export default async function CustomPageView({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const page = await getPublishedCustomPageByHandle(handle);
  if (!page) notFound();

  const media = await resolveCustomPageMedia(page.contentJson);
  const accent = page.accentColor || BRAND_PURPLE;

  return (
    <main
      className="giq-custom-page mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10"
      style={{ ["--page-accent" as string]: accent }}
    >
      {/* Banner + identity header (LinkedIn/FB style, brand-framed) */}
      <header className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[hsl(var(--surface-1))]">
        <div className="relative aspect-[16/5] w-full bg-gradient-to-br from-[hsl(var(--surface-2))] to-black">
          {media.bannerUrl && (
            <Image
              src={media.bannerUrl}
              alt=""
              fill
              sizes="(max-width:768px) 100vw, 1024px"
              className="object-cover"
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-7">
          <div
            className="-mt-10 h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 bg-black"
            style={{ borderColor: accent }}
          >
            {media.avatarUrl ? (
              <Image
                src={media.avatarUrl}
                alt={page.title}
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl font-bold text-white/70">
                {page.title.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))] sm:text-3xl">
                {page.title}
              </h1>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black"
                style={{ background: accent }}
              >
                {CUSTOM_PAGE_TYPE_LABELS[page.pageType as keyof typeof CUSTOM_PAGE_TYPE_LABELS]}
              </span>
            </div>
            {page.tagline && (
              <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">{page.tagline}</p>
            )}
          </div>
          {media.logoUrl && (
            <Image
              src={media.logoUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-lg object-contain"
            />
          )}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {page.about && (
            <section className="giq-panel p-6">
              <h2 className="mb-3 text-[16px] font-semibold text-[hsl(var(--foreground))]">About</h2>
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                {page.about}
              </p>
            </section>
          )}

          {page.pageType === "dog" && media.cardUrl && (
            <div className="mb-6 flex justify-center">
              <Image
                src={media.cardUrl}
                alt={`${page.dog?.name ?? "Dog"} trading card`}
                width={340}
                height={510}
                className="w-64 rounded-xl border border-white/10 shadow-2xl sm:w-72"
                priority
              />
            </div>
          )}

          {page.pageType === "dog" && page.dog && <DogBody page={page} accent={accent} />}

          {page.pageType === "business" && <StorefrontBody profileId={page.ownerProfile.id} />}

          {media.galleryUrls.length > 0 && (
            <section className="giq-panel p-6">
              <h2 className="mb-3 text-[16px] font-semibold text-[hsl(var(--foreground))]">Gallery</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {media.galleryUrls.map((url, i) => (
                  <div key={i} className="overflow-hidden rounded-lg border border-white/[0.06]">
                    <Image
                      src={url}
                      alt=""
                      width={300}
                      height={300}
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <ContactCard page={page} />
          <p className="text-center text-[11px] text-[hsl(var(--subtle-foreground))]">
            Verified on{" "}
            <Link href="/" className="font-semibold text-[hsl(var(--primary-bright))]">
              GreyhoundsIQ
            </Link>
          </p>
        </aside>
      </div>
    </main>
  );
}

function ContactCard({ page }: { page: PublicCustomPage }) {
  const hasContact = page.contactEmail || page.contactPhone || page.website;
  if (!hasContact) return null;
  return (
    <section className="giq-panel p-5">
      <h2 className="mb-3 text-[14px] font-semibold text-[hsl(var(--foreground))]">Contact</h2>
      <ul className="space-y-2 text-[13px] text-[hsl(var(--muted-foreground))]">
        {page.contactEmail && (
          <li className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            <a href={`mailto:${page.contactEmail}`} className="break-all hover:underline">
              {page.contactEmail}
            </a>
          </li>
        )}
        {page.contactPhone && (
          <li className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" />
            <a href={`tel:${page.contactPhone}`} className="hover:underline">
              {page.contactPhone}
            </a>
          </li>
        )}
        {page.website && (
          <li className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" />
            <a
              href={page.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="break-all hover:underline"
            >
              {page.website.replace(/^https?:\/\//, "")}
            </a>
          </li>
        )}
      </ul>
    </section>
  );
}

async function StorefrontBody({ profileId }: { profileId: string }) {
  const listings = await getActiveListingsForProfile(profileId, 12);
  if (listings.length === 0) return null;
  return (
    <section className="giq-panel p-6">
      <h2 className="mb-4 text-[16px] font-semibold text-[hsl(var(--foreground))]">
        For sale
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {listings.map((listing) => {
          const first = listing.media[0]?.media;
          const img = first ? mediaDeliveryUrl(first) : null;
          return (
            <Link
              key={listing.id}
              href={`/listings/${listing.id}`}
              className="group overflow-hidden rounded-lg border border-white/[0.06] bg-[hsl(var(--surface-1))]"
            >
              <div className="aspect-square w-full bg-black/40">
                {img && (
                  <Image
                    src={img}
                    alt={listing.title}
                    width={240}
                    height={240}
                    className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <div className="p-2">
                <div className="truncate text-[12px] font-medium text-[hsl(var(--foreground))]">
                  {listing.title}
                </div>
                {listing.price != null && (
                  <div className="text-[12px] text-[hsl(var(--secondary))]">
                    {money(listing.price)}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

async function DogBody({ page, accent }: { page: PublicCustomPage; accent: string }) {
  const dog = page.dog!;
  const prize = await getDogPrizeMoney(dog.id);
  const careerWinnings = Math.max(dog.prizeMoney ?? 0, prize.careerWon);
  const stats = [
    { label: "Starts", value: dog.careerStarts ?? 0 },
    { label: "Wins", value: dog.careerWins ?? 0 },
    { label: "Prize money", value: money(careerWinnings) ?? "—" },
  ];
  const saleLabel =
    page.saleStatus === "for_sale"
      ? "For sale"
      : page.saleStatus === "stud"
        ? "At stud"
        : null;

  return (
    <section className="giq-panel p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
          {dog.name}
        </h2>
        <div className="flex items-center gap-2">
          {saleLabel && (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold text-black"
              style={{ background: accent }}
            >
              <DollarSign className="h-3.5 w-3.5" />
              {saleLabel}
              {page.priceOrFee != null && ` · ${money(page.priceOrFee)}`}
            </span>
          )}
          {page.saleStatus === "for_sale" && (
            <Link
              href={`/listings/new?dogId=${dog.id}&title=${encodeURIComponent(dog.name)}${
                page.priceOrFee != null ? `&price=${page.priceOrFee}` : ""
              }`}
              className="giq-outline-action text-[12px]"
            >
              List on marketplace
            </Link>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="giq-metric-card text-center">
            <div className="text-xl font-semibold tabular-nums text-[hsl(var(--foreground))]">
              {s.value}
            </div>
            <div className="mt-1 text-[11px] text-[hsl(var(--subtle-foreground))]">{s.label}</div>
          </div>
        ))}
      </div>

      {(dog.sire || dog.dam) && (
        <p className="mb-4 text-[13px] text-[hsl(var(--muted-foreground))]">
          {dog.sire && (
            <>
              by <span className="text-[hsl(var(--foreground))]">{dog.sire.name}</span>
            </>
          )}
          {dog.sire && dog.dam && " · "}
          {dog.dam && (
            <>
              from <span className="text-[hsl(var(--foreground))]">{dog.dam.name}</span>
            </>
          )}
        </p>
      )}

      {dog.formEntries.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-[hsl(var(--subtle-foreground))]">
            <Trophy className="h-3.5 w-3.5" /> Recent form
          </h3>
          <div className="space-y-1.5">
            {dog.formEntries.slice(0, 8).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.05] px-3 py-2 text-[13px]"
              >
                <span className="text-[hsl(var(--muted-foreground))]">
                  {entry.date.toLocaleDateString("en-AU", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                  })}
                </span>
                <span className="flex-1 px-3 text-[hsl(var(--foreground))]">
                  {entry.track?.name ?? "—"}
                  {entry.distance ? ` · ${entry.distance}m` : ""}
                </span>
                <FinishBadge finish={entry.finish} />
                <span className="ml-3 font-mono text-[12px] text-[hsl(var(--primary-bright))]">
                  {entry.time ? `${entry.time.toFixed(2)}s` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
