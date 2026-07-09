import "./load-env";

import { pathToFileURL } from "node:url";

import { prisma } from "../src/lib/db";
import { withDbSystemContext } from "../src/lib/db-context";

const DEFAULT_ADMIN_EMAILS = [
  "daniel.j.fleuren@gmail.com",
  "daniel.fleuren@verridian.ai",
];
const ADMIN_TIER = "pro_plus";
const ADMIN_ROLE = "admin";

export type AdminBootstrapOptions = {
  apply: boolean;
  allowProduction: boolean;
  emails: string[];
};

export function parseAdminBootstrapArgs(args: string[]): AdminBootstrapOptions {
  const emails: string[] = [];
  let apply = false;
  let allowProduction = process.env.ADMIN_BOOTSTRAP_ALLOW_PRODUCTION === "true";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") {
      apply = true;
    } else if (arg === "--dry-run") {
      apply = false;
    } else if (arg === "--allow-production") {
      allowProduction = true;
    } else if (arg === "--email") {
      const email = args[index + 1]?.trim().toLowerCase();
      if (!email) throw new Error("admin.bootstrap.email_required");
      emails.push(email);
      index += 1;
    } else {
      throw new Error(`admin.bootstrap.unknown_arg:${arg}`);
    }
  }

  return {
    apply,
    allowProduction,
    emails: emails.length > 0 ? emails : DEFAULT_ADMIN_EMAILS,
  };
}

export function isProductionTarget(env: NodeJS.ProcessEnv = process.env) {
  const values = [
    env.NODE_ENV,
    env.APP_ENV,
    env.NEXT_PUBLIC_APP_URL,
    env.NEXTAUTH_URL,
    env.WORKOS_REDIRECT_URI,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    /\bproduction\b/.test(values) ||
    values.includes("greyhoundsiq.com.au") ||
    values.includes("greyhoundiq.com.au")
  );
}

async function main() {
  const options = parseAdminBootstrapArgs(process.argv.slice(2));
  if (options.apply && isProductionTarget() && !options.allowProduction) {
    throw new Error(
      "admin.bootstrap.production_blocked: pass --allow-production only after staging verification"
    );
  }

  console.log(options.apply ? "admin bootstrap apply" : "admin bootstrap dry-run");
  for (const email of options.emails) {
    await bootstrapEmail(email, options.apply);
  }
}

async function bootstrapEmail(email: string, apply: boolean) {
  const existing = await withDbSystemContext((tx) =>
    tx.user.findUnique({
      where: { email },
      include: { profile: true },
    })
  );
  const displayName = displayNameForEmail(email);
  const changes = [
    ...(!existing ? ["create user"] : []),
    ...(existing && existing.subscriptionTier !== ADMIN_TIER ? ["tier"] : []),
    ...(existing && existing.isBanned ? ["unban"] : []),
    ...(existing && existing.deletionRequestedAt ? ["cancel deletion"] : []),
    ...(!existing?.profile ? ["create profile"] : []),
    ...(existing?.profile && existing.profile.role !== ADMIN_ROLE ? ["role"] : []),
    ...(existing?.profile && !existing.profile.verified ? ["verified"] : []),
  ];

  if (!apply) {
    console.log(`${email}: ${changes.length ? changes.join(", ") : "already admin"}`);
    return;
  }
  if (changes.length === 0 && existing?.profile) {
    console.log(`${email}: already admin`);
    return;
  }

  const user = await withDbSystemContext(async (tx) => {
    const dbUser = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            name: existing.name ?? displayName,
            subscriptionTier: ADMIN_TIER,
            isBanned: false,
            deletionRequestedAt: null,
          },
        })
      : await tx.user.create({
          data: {
            email,
            name: displayName,
            subscriptionTier: ADMIN_TIER,
          },
        });

    await tx.profile.upsert({
      where: { userId: dbUser.id },
      update: {
        displayName: existing?.profile?.displayName ?? displayName,
        role: ADMIN_ROLE,
        verified: true,
      },
      create: {
        userId: dbUser.id,
        displayName,
        role: ADMIN_ROLE,
        verified: true,
      },
    });

    await tx.adminAction.create({
      data: {
        adminId: null,
        affectedUserId: dbUser.id,
        action: "admin.bootstrap",
        targetType: "user",
        targetId: dbUser.id,
        reason: `Bootstrap full admin for ${email}`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorType: "system",
        action: "admin.bootstrap",
        targetType: "user",
        targetId: dbUser.id,
        metadata: JSON.stringify({ email, changes }),
      },
    });

    return dbUser;
  });

  console.log(`${email}: applied ${changes.join(", ")} (${user.id})`);
}

function displayNameForEmail(email: string) {
  return email.startsWith("daniel.") ? "Daniel Fleuren" : email;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
