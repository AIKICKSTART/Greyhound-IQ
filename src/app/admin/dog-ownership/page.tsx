import { AdminPageHeader } from "@/app/admin/admin-page-header";
import {
  AdminDogOwnershipForm,
  AdminTrainerClaimForm,
} from "@/app/admin/form-controls";
import { requireModeratorProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dog ownership claims - GreyhoundIQ",
  description: "Review and verify pending dog ownership claims.",
};

type DogOwnershipClaimRow = {
  id: string;
  role: string;
  evidence: string | null;
  createdAt: Date;
  dog: { name: string };
  profile: { displayName: string };
};

type TrainerClaimRow = {
  id: string;
  evidence: string;
  sourceProvider: string;
  sourceId: string;
  officialProfileUrl: string | null;
  createdAt: Date;
  trainer: { name: string };
  profile: { displayName: string };
};

export default async function AdminDogOwnershipPage() {
  await requireModeratorProfile();
  const [claims, trainerClaims] = await Promise.all([
    getPendingClaims(),
    getPendingTrainerClaims(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <AdminPageHeader
        title="Racing identity claims"
        description="Review dog ownership and whole-kennel trainer identity requests. Every decision is audited."
      />

      <section className="giq-panel p-6">
        <div className="giq-table-shell overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Dog</th>
                <th className="px-4 py-3 text-left">Claimant</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Evidence</th>
                <th className="px-4 py-3 text-left">Requested</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No pending claims.
                  </td>
                </tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3 text-[13px] font-medium text-[hsl(var(--foreground))]">
                      {claim.dog.name}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {claim.profile.displayName}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {claim.role}
                    </td>
                    <td className="max-w-[280px] px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {claim.evidence ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(claim.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <AdminDogOwnershipForm
                        ownershipId={claim.id}
                        path="/admin/dog-ownership"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="giq-panel mt-6 p-6">
        <h2 className="mb-4 text-[16px] font-semibold text-[hsl(var(--foreground))]">
          Trainer identity claims
        </h2>
        <div className="giq-table-shell overflow-x-auto">
          <table className="w-full min-w-[1080px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Trainer</th>
                <th className="px-4 py-3 text-left">Claimant</th>
                <th className="px-4 py-3 text-left">Provider identity</th>
                <th className="px-4 py-3 text-left">Evidence</th>
                <th className="px-4 py-3 text-left">Requested</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {trainerClaims.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No pending trainer claims.
                  </td>
                </tr>
              ) : (
                trainerClaims.map((claim) => (
                  <tr key={claim.id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3 text-[13px] font-medium text-[hsl(var(--foreground))]">
                      {claim.trainer.name}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {claim.profile.displayName}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[hsl(var(--muted-foreground))]">
                      <span className="block">
                        {claim.sourceProvider}:{claim.sourceId}
                      </span>
                      {claim.officialProfileUrl ? (
                        <a
                          href={claim.officialProfileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[hsl(var(--primary-bright))] hover:underline"
                        >
                          Official profile
                        </a>
                      ) : null}
                    </td>
                    <td className="max-w-[280px] px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {claim.evidence}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(claim.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <AdminTrainerClaimForm
                        trainerClaimId={claim.id}
                        path="/admin/dog-ownership"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function getPendingClaims() {
  return safeQuery<DogOwnershipClaimRow[]>(
    () =>
      withDbSystemContext((tx) =>
        tx.dogOwnership.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "asc" },
          take: 50,
          select: {
            id: true,
            role: true,
            evidence: true,
            createdAt: true,
            dog: { select: { name: true } },
            profile: { select: { displayName: true } },
          },
        })
      ),
    []
  );
}

function getPendingTrainerClaims() {
  return safeQuery<TrainerClaimRow[]>(
    () =>
      withDbSystemContext((tx) =>
        tx.trainerClaim.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "asc" },
          take: 50,
          select: {
            id: true,
            evidence: true,
            sourceProvider: true,
            sourceId: true,
            officialProfileUrl: true,
            createdAt: true,
            trainer: { select: { name: true } },
            profile: { select: { displayName: true } },
          },
        }),
      ),
    [],
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
