import type { VerificationStatus } from "./shared";

export type CryptographyFieldRecord = {
  observation: string;
  verificationStatus: VerificationStatus;
  evidence: readonly string[];
  requiredAction: string;
};

export type CryptographyRecord = {
  algorithms: CryptographyFieldRecord;
  keySizes: CryptographyFieldRecord;
  keyStorage: CryptographyFieldRecord;
  rotation: CryptographyFieldRecord;
  nonceHandling: CryptographyFieldRecord;
  tokenSigning: CryptographyFieldRecord;
  passwordHashingWhereApplicable: CryptographyFieldRecord;
  dataEncryption: CryptographyFieldRecord;
  backupEncryption: CryptographyFieldRecord;
  tlsConfiguration: CryptographyFieldRecord;
};

const incidentAction =
  "Bind the production configuration and an exercised rotation or recovery result to the release candidate.";

/** Documentation record only; partially verified and unknown fields remain release work. */
export const CRYPTOGRAPHY_RECORD: CryptographyRecord = {
  algorithms: field(
    "Node crypto HMAC-SHA-256 and timing-safe comparison protect realtime/internal signatures; provider SDKs own Stripe, WorkOS and LiveKit cryptography.",
    "Partially verified",
    ["src/lib/realtime-service.ts", "src/lib/internal-auth.ts", "src/lib/billing/lago-webhooks.ts"],
    "Verify provider algorithms and production TLS/crypto policies from approved configuration.",
  ),
  keySizes: field(
    "Tracked configuration requires at least 32 characters for realtime, session and cookie-signing material; provider key sizes are not independently captured.",
    "Partially verified",
    [".env.example", "src/lib/realtime-service.ts"],
    "Fail deployment on undersized live secrets and record provider-managed key parameters where exposed.",
  ),
  keyStorage: field(
    "Server credential names are documented for Secret Manager or protected deployment custody; live versions and IAM grants were not inspected.",
    "Not verified",
    ["docs/security/secrets-register.md", ".github/workflows/cloud-run-deploy.yml"],
    "Capture Secret Manager version, owner and least-privilege accessor evidence without copying values.",
  ),
  rotation: field(
    "No approved per-key rotation frequency, last-rotation evidence or overlap drill is bound to the candidate.",
    "Control missing",
    ["docs/security/secrets-register.md", "security/secret-inventory.ts"],
    incidentAction,
  ),
  nonceHandling: field(
    "OAuth/OIDC state, nonce and PKCE behavior is delegated to WorkOS AuthKit and is not independently verified by the application trace.",
    "Not verified",
    ["src/app/callback/route.ts", "security/authentication-path-review.ts"],
    "Record provider configuration and an authorised callback replay/state/nonce validation result.",
  ),
  tokenSigning: field(
    "LiveKit AccessToken signs short-lived room-scoped JWTs; Supabase JWT and HMAC realtime signing keys are named but live scope and rotation remain unverified.",
    "Partially verified",
    ["src/lib/call-token.ts", "src/lib/realtime-service.ts", "docs/security/secrets-register.md"],
    "Verify issuer, audience, algorithm, TTL, key rotation and revocation for every live token type.",
  ),
  passwordHashingWhereApplicable: field(
    "GreyhoundIQ source does not implement a password database; end-user authentication is delegated to WorkOS AuthKit.",
    "Not applicable with justification",
    ["src/app/callback/route.ts", "docs/security/authentication-review.md"],
    "Re-open this control if local password storage or recovery credentials are introduced.",
  ),
  dataEncryption: field(
    "Application data-at-rest encryption and key ownership are provider-managed assumptions without live database, storage or KMS evidence.",
    "Not verified",
    ["docs/security/security-architecture.md", "docs/security/secrets-register.md"],
    "Capture database, object-storage and log encryption configuration plus key ownership.",
  ),
  backupEncryption: field(
    "No live backup object, encryption key, retention lock or restore evidence was inspected.",
    "Not verified",
    ["docs/security/backup-and-recovery.md"],
    "Prove encrypted backup policy, isolated custody and a successful restore exercise.",
  ),
  tlsConfiguration: field(
    "Tracked provider endpoints use HTTPS/WSS examples, but deployed TLS policy, certificates, database TLS and origin validation are not candidate-bound.",
    "Not verified",
    [".env.example", "docs/security/security-architecture.md"],
    "Capture edge/origin/database TLS configuration and certificate-expiry monitoring.",
  ),
};

function field(
  observation: string,
  verificationStatus: VerificationStatus,
  evidence: readonly string[],
  requiredAction: string,
): CryptographyFieldRecord {
  return { observation, verificationStatus, evidence, requiredAction };
}
