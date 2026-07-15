# Secret controls

GreyhoundIQ enforces eight source-verifiable secret boundaries. CI checks the full Git history with a digest-pinned Gitleaks image, validates that `.env.example` contains only empty or explicit placeholder values, and inspects the completed `.next/static` output for configured server-secret values. The deployment workflow uses GitHub OIDC and Google Workload Identity Federation instead of a stored Google service-account key.

Runtime output must use `src/lib/logger.ts`. Its structured sanitizer redacts sensitive keys, bearer credentials, JWT-shaped values, URL user information, assignments and error text; CI rejects direct server-side console or process-stream bypasses. Onboarding analytics accepts only the fixed `schemaVersion`, `event`, `tourId` and `stepId` schema, so credentials and free-form values are rejected before recording.

Tracked application cryptography uses Node/Web Crypto or provider SDKs. An exhaustive source test requires every application encryption implementation to appear in the independent review registry. The only application encryption implementation is the replay capability: AES-256-GCM with a random 96-bit IV, 128-bit authentication tag, versioned associated data and a 256-bit key derived with HKDF-SHA-256 from at least 32 bytes of secret material. The envelope only serializes the version, IV, authentication tag and ciphertext; it does not define a cipher or novel cryptographic algorithm. Runtime tests reject tampering, expiry, invalid targets and undersized secrets. HMAC verification uses SHA-256 and constant-time comparison.

The following controls remain open and must not be inferred from this evidence:

- development/production value separation, because live secret values were not compared;
- overlap-safe rotation and emergency revocation, because no live exercise is candidate-bound;

Run `npm run check:secret-boundaries` for source controls. Run `npm run build` followed by `npm run check:secret-boundaries -- --built` to inspect client output. Neither command prints secret values.
