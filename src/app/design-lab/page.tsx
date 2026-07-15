import type { Metadata } from "next";

import { DemoExperienceScreenMap } from "@/components/demo-experience-screen-map";
import { resolveDesignLabArea } from "@/components/design-lab-workspace";
import { requireDesignLabReviewer } from "@/lib/design-lab-access";

export const metadata: Metadata = {
  title: "GreyhoundIQ Design Lab",
  description:
    "GreyhoundIQ screen explorer, product-contract checklist and release evidence workspace.",
  robots: { index: false, follow: false },
};

type DesignLabSearchParams = {
  area?: string | string[];
  route?: string | string[];
};

export default async function DesignLabPage({
  searchParams,
}: {
  searchParams: Promise<DesignLabSearchParams>;
}) {
  await requireDesignLabReviewer();
  const query = await searchParams;
  const area = resolveDesignLabArea(query.area);

  return (
    <DemoExperienceScreenMap
      initialArea={area}
      initialContractRoute={firstValue(query.route)}
      basePath="/design-lab"
    />
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
