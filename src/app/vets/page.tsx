import { Suspense } from "react";
import { Stethoscope } from "lucide-react";
import { VetFinder } from "@/components/vet-finder/VetFinder";
import { VET_LOCATIONS } from "@/data/vet-locations";

const CLINIC_COUNT = VET_LOCATIONS.length;

export const metadata = {
  title: "Vet Finder — GreyhoundIQ",
  description: `Find greyhound-friendly veterinary clinics across Australia. Search ${CLINIC_COUNT} clinics by suburb, service, state or distance on an interactive map — with directions, hours and contact details.`,
};

export default function VetsPage(): React.JSX.Element {
  return (
    <div>
      <header className="border-b border-[hsl(var(--border))] bg-[radial-gradient(circle_at_82%_14%,hsl(var(--primary-bright)/0.10),transparent_36%),radial-gradient(circle_at_12%_92%,hsl(var(--secondary)/0.06),transparent_32%)]">
        <div className="mx-auto w-full max-w-[1600px] px-6 py-10">
          <div className="giq-badge giq-badge-purple mb-4 inline-flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
            <span>VET FINDER</span>
          </div>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))] md:text-4xl">
            Greyhound-friendly vets across{" "}
            <span className="gradient-text">Australia</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            {CLINIC_COUNT} veterinary clinics compiled from racing-industry directories and verified sources. Search by suburb,
            service or distance, then get directions. Confirm details with the clinic before visiting.
          </p>
        </div>
      </header>

      <Suspense fallback={null}>
        <VetFinder />
      </Suspense>
    </div>
  );
}
