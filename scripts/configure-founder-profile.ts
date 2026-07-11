import "./load-env";

import { pathToFileURL } from "node:url";

import { prisma } from "../src/lib/db";
import { withDbSystemContext } from "../src/lib/db-context";

const FOUNDER_EMAIL = "daniel.fleuren@aikickstart.com.au";
const FOUNDER = {
  displayName: "Daniel Fleuren",
  bio: "Founder of GreyhoundIQ, building Australia’s most connected greyhound racing intelligence and community platform.",
  location: "New South Wales, Australia",
} as const;

async function main() {
  const apply = process.argv.includes("--apply");
  const allowProduction = process.argv.includes("--allow-production");
  const unknown = process.argv.slice(2).filter(
    (arg) => arg !== "--apply" && arg !== "--dry-run" && arg !== "--allow-production"
  );
  if (unknown.length > 0) throw new Error(`founder.configure.unknown_arg:${unknown[0]}`);
  if (apply && productionTarget() && !allowProduction) {
    throw new Error("founder.configure.production_blocked");
  }

  const user = await withDbSystemContext((tx) =>
    tx.user.findUnique({
      where: { email: FOUNDER_EMAIL },
      include: { profile: { include: { socialActor: true } } },
    })
  );
  const profile = user?.profile;
  const actor = profile?.socialActor;
  if (!user || !profile || !profile.verified || profile.role !== "admin") {
    throw new Error("founder.configure.verified_admin_not_found");
  }
  if (!actor || actor.kind !== "personal" || !actor.published) {
    throw new Error("founder.configure.published_actor_not_found");
  }

  const changes = [
    ...(!profile.isFounder ? ["designation"] : []),
    ...(profile.displayName !== FOUNDER.displayName ? ["displayName"] : []),
    ...(profile.bio !== FOUNDER.bio ? ["bio"] : []),
    ...(profile.state !== FOUNDER.location ? ["location"] : []),
    ...(actor.displayName !== FOUNDER.displayName ? ["actorDisplayName"] : []),
    ...(actor.profileVisibility !== "public" ? ["profileVisibility"] : []),
    ...(actor.contactVisibility !== "only_me" ? ["contactVisibility"] : []),
  ];

  if (!apply) {
    console.log(`founder profile dry-run: ${changes.length ? changes.join(", ") : "already configured"}`);
    return;
  }
  if (changes.length === 0) {
    console.log("founder profile already configured");
    return;
  }

  await withDbSystemContext(async (tx) => {
    await tx.profile.update({
      where: { id: profile.id },
      data: {
        displayName: FOUNDER.displayName,
        bio: FOUNDER.bio,
        state: FOUNDER.location,
        isFounder: true,
      },
    });
    await tx.socialActor.update({
      where: { id: actor.id },
      data: {
        displayName: FOUNDER.displayName,
        profileVisibility: "public",
        contactVisibility: "only_me",
      },
    });
    await tx.auditLog.createMany({
      data: {
        actorId: user.id,
        actorType: "admin",
        action: "profile.founder_designated",
        targetType: "profile",
        targetId: profile.id,
        metadata: JSON.stringify({ actorId: actor.id, changes, handlePreserved: true }),
      },
    });
  });
  console.log("founder profile applied to canonical verified admin");
}

function productionTarget() {
  const target = [
    process.env.NODE_ENV,
    process.env.APP_ENV,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.WORKOS_REDIRECT_URI,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\bproduction\b/.test(target) || target.includes("greyhoundsiq.com.au");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
