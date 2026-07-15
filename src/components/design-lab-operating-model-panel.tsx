import {
  Boxes,
  Clapperboard,
  CloudCog,
  Gauge,
  KeyRound,
  MonitorSmartphone,
  ServerCog,
  ShieldCheck,
  TestTubeDiagonal,
  type LucideIcon,
} from "lucide-react";

import {
  DESIGN_LAB_ADMIN_PLANES,
  DESIGN_LAB_BREAK_GLASS,
  DESIGN_LAB_ENVIRONMENTS,
  DESIGN_LAB_MOBILE_CONTRACT,
  DESIGN_LAB_OPERATING_CAPABILITIES,
  DESIGN_LAB_OPERATING_MODEL_SUMMARY,
  DESIGN_LAB_PRODUCT_BOUNDARIES,
  DESIGN_LAB_RELEASE_AUTHORITY,
  DESIGN_LAB_SHARED_CROSS_PRODUCT_ARTIFACTS,
  DESIGN_LAB_TRAINING_VIDEO_STUDIO,
  type DesignLabOperatingCapabilityId,
} from "./design-lab-operating-model";

const CAPABILITY_ICONS: Record<DesignLabOperatingCapabilityId, LucideIcon> = {
  "experience-simulation": Boxes,
  "feature-proving": TestTubeDiagonal,
  "training-video-studio": Clapperboard,
  "preproduction-digital-twin": CloudCog,
  "production-operations-desk": Gauge,
  "release-authority": KeyRound,
};

/** Visible, read-only rendering of the binding Design Lab operating model. */
export function DesignLabOperatingModelPanel() {
  return (
    <section
      className="giq-panel mt-5 overflow-hidden p-4 sm:p-6"
      aria-labelledby="design-lab-operating-model-heading"
      data-design-lab-operating-model
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Binding operating model
          </p>
          <h2
            id="design-lab-operating-model-heading"
            className="mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
          >
            Simulate locally. Prove managed services in staging. Operate
            production read-only.
          </h2>
          <p className="mt-3 max-w-3xl text-[12px] leading-6 text-[hsl(var(--muted-foreground))]">
            Local PostgreSQL, gateway and CDN behavior are simulations. Only the
            protected GCP staging twin can prove real AlloyDB, Cloud Endpoints
            ESPv2, Cloud CDN and Cloud Armor parity. Production is not a proving
            environment and the Design Lab cannot approve a release.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric
            label="Capabilities"
            value={DESIGN_LAB_OPERATING_MODEL_SUMMARY.capabilities}
          />
          <Metric
            label="Environments"
            value={DESIGN_LAB_OPERATING_MODEL_SUMMARY.environments}
          />
          <Metric
            label="Admin planes"
            value={DESIGN_LAB_OPERATING_MODEL_SUMMARY.adminPlanes}
          />
          <Metric
            label="Open gate tasks"
            value={DESIGN_LAB_OPERATING_MODEL_SUMMARY.gateTasks}
          />
        </dl>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {DESIGN_LAB_OPERATING_CAPABILITIES.map((capability) => {
          const Icon = CAPABILITY_ICONS[capability.id];
          return (
            <article
              key={capability.id}
              className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
              data-operating-capability={capability.id}
            >
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[hsl(var(--primary-light)/0.25)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary-light))]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="break-words text-[9px] font-black uppercase tracking-[0.12em] text-[hsl(var(--secondary-light))]">
                    {capability.id}
                  </p>
                  <h3 className="mt-1 text-base font-semibold">
                    {capability.label}
                  </h3>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
                {capability.purpose}
              </p>
              <dl className="mt-3 grid gap-2 text-[10px] leading-5">
                <Fact
                  label="Runs in"
                  value={capability.environments.join(" · ")}
                />
                <Fact label="Production boundary" value={capability.productionBoundary} />
              </dl>
              <ul className="mt-3 grid gap-1.5" aria-label={`${capability.label} outputs`}>
                {capability.outputs.map((output) => (
                  <li
                    key={output}
                    className="flex gap-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]"
                  >
                    <span
                      className="mt-2 size-1 shrink-0 rounded-full bg-emerald-300"
                      aria-hidden="true"
                    />
                    {output}
                  </li>
                ))}
              </ul>
              <p className="mt-3 break-words border-t border-white/[0.06] pt-3 text-[9px] leading-4 text-[hsl(var(--subtle-foreground))]">
                Gate tasks: {capability.gateIds.join(" · ")}
              </p>
            </article>
          );
        })}
      </div>

      <div className="mt-5">
        <div className="mb-3 max-w-3xl">
          <h3 className="text-lg font-semibold">Environment proof boundary</h3>
          <p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
            Passing local contract tests cannot be relabelled as managed-service
            evidence. Production supplies redacted operational observation only.
          </p>
        </div>
        <div
          className="grid gap-3 lg:grid-cols-3"
          aria-label="Design Lab environment proof matrix"
          data-environment-proof-grid
        >
          {DESIGN_LAB_ENVIRONMENTS.map((environment) => (
            <article
              key={environment.id}
              data-operating-environment={environment.id}
              className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
            >
              <h4 className="text-[11px] font-semibold text-[hsl(var(--foreground))]">
                {environment.label}
              </h4>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] text-[hsl(var(--secondary-light))]">
                {environment.posture}
              </p>
              <dl className="mt-4 grid gap-3">
                <Fact label="Proof authority" value={environment.proofAuthority} />
                <Fact label="Database" value={environment.services.database} />
                <Fact label="API gateway" value={environment.services.apiGateway} />
                <Fact label="Edge / CDN" value={environment.services.edgeAndCdn} />
                <Fact label="Write policy" value={environment.writePolicy} />
              </dl>
            </article>
          ))}
        </div>
      </div>

      <section
        className="mt-5 rounded-xl border border-sky-300/20 bg-sky-300/[0.035] p-4 sm:p-5"
        aria-labelledby="design-lab-product-boundaries-heading"
        data-mobile-cross-product-contract
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-sky-100">
              <MonitorSmartphone className="size-4" aria-hidden="true" />
              Post-MVP mobile boundary
            </p>
            <h3
              id="design-lab-product-boundaries-heading"
              className="mt-2 text-lg font-semibold"
            >
              Four products, independent source and release boundaries
            </h3>
            <p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
              iOS/iPadOS and Android/tablet are separate codebases. They are
              never embedded, built, signed or deployed from this Next.js web
              repository. Design Lab tracks shared contracts, compatibility and
              evidence; it does not contain native implementation. The
              2026-07-15 MVP decision defers native store delivery until after
              the production web release, so these five requirements remain
              visible but do not inflate the MVP deployment denominator.
            </p>
          </div>
          <div className="rounded-lg border border-sky-200/15 bg-black/10 px-3 py-2 text-[9px] leading-4 text-sky-50">
            Native strategy ADR: {DESIGN_LAB_MOBILE_CONTRACT.architectureDecision.status}
            <br />
            MVP blocker: {DESIGN_LAB_MOBILE_CONTRACT.webMvpReleaseBlocking ? "yes" : "no"}
            <br />
            Store policy: {DESIGN_LAB_MOBILE_CONTRACT.storePolicyVerification}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {DESIGN_LAB_PRODUCT_BOUNDARIES.map((boundary) => (
            <article
              key={boundary.id}
              className="rounded-xl border border-white/[0.08] bg-black/10 p-3"
              data-product-boundary={boundary.id}
            >
              <div className="flex items-center gap-2">
                {boundary.clientKind === "service" ? (
                  <ServerCog className="size-4 text-sky-100" aria-hidden="true" />
                ) : (
                  <MonitorSmartphone className="size-4 text-sky-100" aria-hidden="true" />
                )}
                <h4 className="text-[11px] font-semibold">{boundary.label}</h4>
              </div>
              <dl className="mt-3 grid gap-2">
                <Fact label="Source" value={boundary.sourceBoundary} />
                <Fact label="Deploy" value={boundary.deploymentBoundary} />
                <Fact
                  label="Design Lab owns"
                  value={boundary.designLabResponsibility}
                />
              </dl>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[0.08] bg-black/10 p-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-100">
              Shared contracts only
            </h4>
            <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
              {DESIGN_LAB_SHARED_CROSS_PRODUCT_ARTIFACTS.join(" · ")}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-black/10 p-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-100">
              Native proof after web MVP
            </h4>
            <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
              Post-MVP delivery still requires OIDC authorization code + PKCE
              in the system browser; verified
              deep links; Keychain/Keystore token protection; APNs/FCM;
              offline, reconnect, background and media recovery; API minimum
              version kill switch; crash and ANR observability; simulator plus
              real phone and tablet evidence.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <section aria-labelledby="design-lab-admin-planes-heading">
          <h3 id="design-lab-admin-planes-heading" className="text-lg font-semibold">
            Two protected admin planes
          </h3>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
            Neither plane can self-promote. Both default production access to
            read-only and require phishing-resistant MFA, JIT access,
            reauthentication, a reason and an audit record.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {DESIGN_LAB_ADMIN_PLANES.map((plane) => (
              <article
                key={plane.id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
                data-admin-plane={plane.id}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[hsl(var(--secondary-light))]">
                  {plane.id}
                </p>
                <h4 className="mt-1 text-base font-semibold">{plane.label}</h4>
                <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
                  {plane.scope}
                </p>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Fact label="Production default" value={plane.productionDefault} />
                  <Fact label="Role management" value={plane.roleManagement} />
                  <Fact label="MFA" value={plane.controls.mfa} />
                  <Fact
                    label="Two-person approval"
                    value={plane.twoPersonApprovalFor.join(" + ")}
                  />
                </dl>
                <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.08em] text-rose-100">
                  No self-promotion · no self-approval
                </p>
              </article>
            ))}
          </div>
        </section>

        <aside className="grid gap-3">
          <section
            className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
            aria-labelledby="training-video-pipeline-heading"
          >
            <h3
              id="training-video-pipeline-heading"
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.11em]"
            >
              <Clapperboard className="size-4 text-[hsl(var(--primary-light))]" aria-hidden="true" />
              Training-video pipeline
            </h3>
            <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
              Capture manifest → {DESIGN_LAB_TRAINING_VIDEO_STUDIO.renderer} →{" "}
              {DESIGN_LAB_TRAINING_VIDEO_STUDIO.narrationProvider} → captions →
              human approval.
            </p>
            <p className="mt-2 text-[9px] leading-4 text-[hsl(var(--subtle-foreground))]">
              {DESIGN_LAB_TRAINING_VIDEO_STUDIO.captureManifestRequiredFields.length}{" "}
              required manifest fields bind route, role, fixture, state, source,
              image, frames, redaction and evidence digests.
            </p>
          </section>

          <section
            className="rounded-xl border border-rose-300/20 bg-rose-300/[0.05] p-4"
            aria-labelledby="break-glass-heading"
          >
            <h3 id="break-glass-heading" className="text-[11px] font-black uppercase tracking-[0.11em] text-rose-100">
              Controlled break-glass
            </h3>
            <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
              Disabled by default. {DESIGN_LAB_BREAK_GLASS.activation}; maximum{" "}
              {DESIGN_LAB_BREAK_GLASS.maximumDurationMinutes} minutes, immediate
              notification, immutable audit and automatic expiry.
            </p>
          </section>

          <section
            className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.045] p-4"
            aria-labelledby="release-authority-heading"
          >
            <h3 id="release-authority-heading" className="text-[11px] font-black uppercase tracking-[0.11em] text-emerald-100">
              Release authority
            </h3>
            <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">
              {DESIGN_LAB_RELEASE_AUTHORITY.authority} owns approval. Successful
              CI, an immutable candidate, an evidence digest and human approval
              remain mandatory; the Design Lab UI cannot approve or deploy.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-xl border border-white/[0.09] bg-white/[0.035] p-3 text-center">
      <dt className="text-[9px] font-black uppercase tracking-[0.11em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[8px] font-black uppercase tracking-[0.09em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
        {value}
      </dd>
    </div>
  );
}
