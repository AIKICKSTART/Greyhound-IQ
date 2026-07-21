"use client";

import { Search, Navigation, Loader2, ChevronDown } from "lucide-react";
import type { VetFilterState } from "./vet-utils";
import { SERVICE_FILTERS } from "./vet-utils";

type GeoStatus = "idle" | "locating" | "error";

interface VetFiltersProps {
  filters: VetFilterState;
  onPatch: (patch: Partial<VetFilterState>) => void;
  states: string[];
  suggestions: string[];
  onUseLocation: () => void;
  geoStatus: GeoStatus;
}

const RADIUS_OPTIONS = [0, 25, 50, 100, 250] as const;

/**
 * Horizontal "care-network" control card: search, service, state, open-now
 * toggle, geolocation and (when located) a radius. Basemap selection lives on
 * the map itself as floating pills.
 */
export function VetFilters({
  filters,
  onPatch,
  states,
  suggestions,
  onUseLocation,
  geoStatus,
}: VetFiltersProps): React.JSX.Element {
  const hasLocation = filters.userCoordinates !== null;

  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="giq-vet-controls grid items-end gap-3 lg:grid-cols-[minmax(240px,1.7fr)_minmax(150px,0.85fr)_minmax(170px,0.95fr)_auto_auto]"
    >
      <ControlGroup label="Search locations" htmlFor="vet-search">
        <div className="giq-vet-field relative flex h-12 items-center overflow-hidden">
          <Search
            className="pointer-events-none absolute left-3.5 h-[18px] w-[18px] text-[hsl(var(--foreground)/0.85)]"
            aria-hidden="true"
          />
          <input
            id="vet-search"
            type="search"
            value={filters.query}
            onChange={(event) => onPatch({ query: event.target.value })}
            placeholder="Suburb, postcode or clinic"
            aria-label="Search clinics"
            list="vet-suggestions"
            autoComplete="off"
            spellCheck={false}
            className="h-full w-full min-w-0 border-0 bg-transparent pl-11 pr-3 text-[14px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[hsl(var(--primary-light))]"
          />
          <datalist id="vet-suggestions">
            {suggestions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </div>
      </ControlGroup>

      <ControlGroup label="Service" htmlFor="vet-service">
        <SelectField
          id="vet-service"
          value={filters.service}
          onChange={(value) => onPatch({ service: value })}
        >
          <option value="">All services</option>
          {SERVICE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </SelectField>
      </ControlGroup>

      <ControlGroup label="State or territory" htmlFor="vet-state">
        <SelectField
          id="vet-state"
          value={filters.state}
          onChange={(value) => onPatch({ state: value })}
        >
          <option value="">All states &amp; territories</option>
          {states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </SelectField>
      </ControlGroup>

      <ControlGroup label="Availability">
        <button
          type="button"
          onClick={() => onPatch({ openNow: !filters.openNow })}
          aria-pressed={filters.openNow}
          className="giq-vet-field inline-flex h-12 items-center gap-2.5 px-3.5 text-[13px] font-semibold text-[hsl(var(--foreground))]"
        >
          <span
            aria-hidden="true"
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              filters.openNow
                ? "bg-[hsl(var(--secondary)/0.85)]"
                : "bg-[hsl(var(--surface-1)/0.9)] ring-1 ring-inset ring-[hsl(var(--border))]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                filters.openNow ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
          Open now
        </button>
      </ControlGroup>

      <ControlGroup label="Nearby">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUseLocation}
            aria-pressed={hasLocation}
            className="giq-vet-field giq-vet-field--accent inline-flex h-12 items-center gap-2 whitespace-nowrap px-4 text-[13px] font-semibold"
          >
            {geoStatus === "locating" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Navigation className="h-4 w-4" aria-hidden="true" />
            )}
            Use my location
          </button>
          {hasLocation && (
            <SelectField
              id="vet-radius"
              value={String(filters.radiusKm)}
              onChange={(value) => onPatch({ radiusKm: Number(value) })}
              ariaLabel="Distance radius"
              className="h-12 w-24"
            >
              {RADIUS_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  {km === 0 ? "Any" : `${km} km`}
                </option>
              ))}
            </SelectField>
          )}
        </div>
      </ControlGroup>

      {geoStatus === "error" && (
        <p className="text-[12px] text-[hsl(var(--secondary-light))] lg:col-span-full">
          Location unavailable. Allow location access or search by suburb instead.
        </p>
      )}
    </form>
  );
}

function ControlGroup({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-bold uppercase tracking-[0.05em] text-[hsl(var(--subtle-foreground))]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function SelectField({
  id,
  value,
  onChange,
  children,
  ariaLabel,
  className = "h-12 w-full",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={`giq-vet-field relative flex items-center overflow-hidden ${className}`}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        className="h-full w-full min-w-0 appearance-none border-0 bg-transparent pl-3.5 pr-9 text-[13px] text-[hsl(var(--foreground))] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[hsl(var(--primary-light))]"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 h-4 w-4 text-[hsl(var(--subtle-foreground))]"
        aria-hidden="true"
      />
    </div>
  );
}
