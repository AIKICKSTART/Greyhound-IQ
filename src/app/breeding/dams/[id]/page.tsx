import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BreedingProgenyRecord } from "@/components/breeding-progeny-record";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";
import { RacingDataDisclosure } from "@/components/racing-data-disclosure";
import { getDamStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stats = await getDamStats(id);
  if (!stats) {
    return {
      title: "Dam not found — GreyhoundIQ",
      description: "Dam statistics not found in the national database.",
    };
  }
  const description = `Progeny record and top performers for the greyhound dam ${stats.dog.name}, drawn from the racing record.`;
  return {
    title: `${stats.dog.name} — Dam Statistics | GreyhoundIQ`,
    description,
    alternates: { canonical: `/breeding/dams/${id}` },
  };
}

function formatEarnings(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default async function DamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stats = await getDamStats(id);
  if (!stats) notFound();

  const { dog, progeny, topProgeny } = stats;
  const ownRecord =
    dog.careerStarts != null && dog.careerWins != null
      ? `${dog.careerWins} wins from ${dog.careerStarts} starts`
      : null;
  const meta = [
    dog.sex === "F" ? "Bitch" : dog.sex === "M" ? "Dog" : null,
    dog.colour,
    dog.whelpYear ? String(dog.whelpYear) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Breeding", path: "/breeding" },
            { name: dog.name, path: `/breeding/dams/${dog.id}` },
          ]),
        ]}
      />
      <RacingDataDisclosure className="mb-8" />

      <Link
        href="/breeding"
        className="mb-6 inline-flex items-center gap-2 text-[13px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" /> Breeding intelligence
      </Link>

      <header className="mb-8">
        <p className="giq-eyebrow mb-2 text-[hsl(var(--subtle-foreground))]">Dam statistics</p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))] sm:text-4xl">
          {dog.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-[hsl(var(--muted-foreground))]">
          {meta && <span>{meta}</span>}
          {ownRecord && (
            <span className="tabular-nums">
              · {ownRecord}
              {dog.prizeMoney != null ? ` · ${formatEarnings(dog.prizeMoney)}` : ""}
            </span>
          )}
          <Link href={`/dogs/${dog.id}`} className="text-[hsl(var(--primary-bright))] hover:underline">
            · Full profile
          </Link>
        </div>
      </header>

      <BreedingProgenyRecord
        progeny={progeny}
        topProgeny={topProgeny}
        emptyDescription="No progeny of this dam carry earnings in the current snapshot. GreyhoundIQ does not invent progeny results."
      />
    </div>
  );
}
