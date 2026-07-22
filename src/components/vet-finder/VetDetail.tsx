"use client";

import { useState } from "react";
import { X, MapPin, Phone, MessageSquare, Mail, Globe, Clock, Navigation, Share2, ExternalLink } from "lucide-react";
import type { VetResult } from "./vet-utils";
import { openingStatus } from "./vet-utils";

interface VetDetailProps {
  location: VetResult;
  onClose: () => void;
}

function directionsUrl(location: VetResult): string {
  const query = encodeURIComponent(`${location.name}, ${location.address}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

/** Full clinic detail card. Honest — only renders fields present on the record. */
export function VetDetail({ location, onClose }: VetDetailProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const status = openingStatus(location);
  const canShare = typeof navigator !== "undefined" && Boolean(navigator.clipboard || navigator.share);

  const handleShare = async (): Promise<void> => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}?sel=${encodeURIComponent(location.id)}`
        : "";
    const text = `${location.name} — ${location.address}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: location.name, text, url });
        return;
      }
      await navigator.clipboard.writeText(url || text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // User dismissed the share sheet, or clipboard was denied — no-op.
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="giq-vet-detail-header flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold text-[hsl(var(--foreground))] tracking-[-0.02em]">
            {location.name}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {status && (
              <span className={`giq-pill ${status === "open" ? "giq-pill-green" : "giq-pill-muted"} text-[10px]`}>
                {status === "open" ? "Open now" : "Closed"}
              </span>
            )}
            {location.greyhoundInterest && (
              <span className="giq-pill giq-pill-gold text-[10px]">Greyhound-focused</span>
            )}
            {location.area && <span className="giq-pill giq-pill-muted text-[10px]">{location.area}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close clinic details"
          className="giq-icon-button shrink-0"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <dl className="flex flex-col gap-3 text-[13px]">
        <Row icon={MapPin} label="Address">
          <span className="text-[hsl(var(--muted-foreground))]">{location.address}</span>
        </Row>
        {location.phone && (
          <Row icon={Phone} label="Phone">
            <a href={`tel:${location.phone.replace(/\s+/g, "")}`} className="text-[hsl(var(--primary-bright))] tabular-nums hover:underline">
              {location.phone}
            </a>
          </Row>
        )}
        {location.sms && (
          <Row icon={MessageSquare} label="SMS">
            <a href={`sms:${location.sms.replace(/\s+/g, "")}`} className="text-[hsl(var(--primary-bright))] tabular-nums hover:underline">
              {location.sms}
            </a>
          </Row>
        )}
        {location.email && (
          <Row icon={Mail} label="Email">
            <a href={`mailto:${location.email}`} className="text-[hsl(var(--primary-bright))] hover:underline">
              {location.email}
            </a>
          </Row>
        )}
        {location.website && (
          <Row icon={Globe} label="Website">
            <a
              href={location.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[hsl(var(--primary-bright))] hover:underline"
            >
              {location.websiteLabel || "Visit website"}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </Row>
        )}
        {location.openingHours.length > 0 && (
          <Row icon={Clock} label="Opening hours">
            <ul className="flex flex-col gap-0.5 text-[hsl(var(--muted-foreground))]">
              {location.openingHours.map((line) => (
                <li key={line} className="tabular-nums">
                  {line}
                </li>
              ))}
            </ul>
          </Row>
        )}
      </dl>

      {location.services.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {location.services.map((service) => (
            <span key={service} className="giq-chip text-[11px]">
              {service}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <a
          href={directionsUrl(location)}
          target="_blank"
          rel="noopener noreferrer"
          className="giq-button giq-button-primary inline-flex items-center gap-2 px-4 text-[13px] font-semibold"
        >
          <Navigation className="h-4 w-4" aria-hidden="true" />
          Directions
        </a>
        {canShare && (
          <button
            type="button"
            onClick={() => void handleShare()}
            className="giq-button giq-button-glass inline-flex items-center gap-2 px-4 text-[13px] font-semibold"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            {copied ? "Link copied" : "Share"}
          </button>
        )}
      </div>

    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
          {label}
        </dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  );
}
