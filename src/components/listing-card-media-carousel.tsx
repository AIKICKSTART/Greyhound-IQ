"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon, Paperclip } from "lucide-react";
import { useState } from "react";

export type ListingCardMediaItem = {
  id: string;
  src: string;
  alt: string;
  originalName: string | null;
  mimeType: string;
  widthPx: number | null;
  heightPx: number | null;
};

export type ListingCardFallbackImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export function ListingCardMediaCarousel({
  listingHref,
  listingTitle,
  media,
  fallbackImage,
}: {
  listingHref: string;
  listingTitle: string;
  media: ListingCardMediaItem[];
  fallbackImage?: ListingCardFallbackImage;
}) {
  const images = media.filter((item) => item.mimeType.startsWith("image/"));
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const activeImage = images[activeIndex] ?? images[0];
  const activeImageIndex = images[activeIndex] ? activeIndex : 0;

  if (!activeImage) {
    const firstAttachment = media[0];
    if (firstAttachment) {
      return (
        <Link
          href={listingHref}
          className="giq-listing-media flex aspect-[16/10] items-center justify-center gap-2 px-4 text-center text-[12px] font-semibold text-[hsl(215_14%_80%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-bright))]"
        >
          <Paperclip className="h-4 w-4 shrink-0 text-[hsl(var(--primary-bright))]" />
          <span className="truncate">
            {firstAttachment.originalName ?? firstAttachment.mimeType}
          </span>
        </Link>
      );
    }

    if (fallbackImage) {
      return (
        <Link
          href={listingHref}
          className="giq-listing-media block aspect-[16/10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-bright))]"
        >
          <Image
            src={fallbackImage.src}
            alt={fallbackImage.alt}
            width={fallbackImage.width}
            height={fallbackImage.height}
            sizes="(min-width: 1024px) 30vw, (min-width: 768px) 50vw, 100vw"
            className="h-full w-full object-cover"
          />
        </Link>
      );
    }

    return (
      <Link
        href={listingHref}
        className="giq-listing-media flex aspect-[16/10] flex-col items-center justify-center gap-2 text-[12px] font-semibold text-[hsl(215_14%_72%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-bright))]"
      >
        <ImageIcon className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
        <span>No image uploaded</span>
      </Link>
    );
  }

  const imageCount = images.length;
  const isPortrait =
    activeImage.widthPx != null &&
    activeImage.heightPx != null &&
    activeImage.heightPx > activeImage.widthPx;

  const showPreviousImage = () => {
    setIsLoaded(false);
    setHasLoadError(false);
    setActiveIndex((current) => (current - 1 + imageCount) % imageCount);
  };

  const showNextImage = () => {
    setIsLoaded(false);
    setHasLoadError(false);
    setActiveIndex((current) => (current + 1) % imageCount);
  };

  return (
    <div className="giq-listing-media group relative aspect-[16/10] overflow-hidden bg-black/20">
      <Link
        href={listingHref}
        className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-bright))]"
      >
        <Image
          key={activeImage.id}
          src={activeImage.src}
          alt={activeImage.alt || listingTitle}
          width={activeImage.widthPx ?? 520}
          height={activeImage.heightPx ?? 320}
          sizes="(min-width: 1024px) 30vw, (min-width: 768px) 50vw, 100vw"
          onLoad={() => {
            setIsLoaded(true);
            setHasLoadError(false);
          }}
          onError={() => {
            setIsLoaded(true);
            setHasLoadError(true);
          }}
          className={`h-full w-full transition-opacity duration-300 ${
            isPortrait ? "object-contain" : "object-cover"
          } ${isLoaded && !hasLoadError ? "opacity-100" : "opacity-0"}`}
        />
        {!isLoaded && (
          <div
            aria-hidden="true"
            className="absolute inset-0 animate-pulse bg-white/[0.04]"
          />
        )}
        {hasLoadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 text-[12px] font-semibold text-[hsl(215_14%_76%)]">
            <ImageIcon className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
            <span>Image unavailable</span>
          </div>
        )}
      </Link>

      {imageCount > 1 && (
        <>
          <button
            type="button"
            aria-label={`Show previous image for ${listingTitle}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              showPreviousImage();
            }}
            className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/75 text-white shadow-xl shadow-black/35 backdrop-blur transition hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-95"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label={`Show next image for ${listingTitle}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              showNextImage();
            }}
            className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/75 text-white shadow-xl shadow-black/35 backdrop-blur transition hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-95"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg shadow-black/25">
            <span aria-live="polite">
              {activeImageIndex + 1} / {imageCount}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
