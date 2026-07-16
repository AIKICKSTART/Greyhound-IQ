import assert from "node:assert/strict";
import {
  resolveWorkosBaseUrl,
  resolveWorkosRedirectUri,
  resolveWorkosReturnTo,
} from "./workos-redirect";

const ENV_KEYS = [
  "NODE_ENV",
  "NEXTAUTH_URL",
  "AUTH_URL",
  "WORKOS_REDIRECT_URI",
  "NEXT_PUBLIC_WORKOS_REDIRECT_URI",
] as const;

function withEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>, run: () => void) {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previous = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) previous.set(key, mutableEnv[key]);

  try {
    for (const key of ENV_KEYS) delete mutableEnv[key];
    for (const [key, value] of Object.entries(env)) mutableEnv[key] = value;
    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete mutableEnv[key];
      else mutableEnv[key] = value;
    }
  }
}

withEnv(
  {
    NODE_ENV: "production",
    NEXTAUTH_URL: "https://greyhoundsiq.com.au",
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://0.0.0.0:8080/callback",
  },
  () => {
    assert.equal(resolveWorkosBaseUrl(), "https://greyhoundsiq.com.au");
    assert.equal(
      resolveWorkosRedirectUri(),
      "https://greyhoundsiq.com.au/callback"
    );
  }
);

withEnv(
  {
    NODE_ENV: "production",
    AUTH_URL: "https://staging.greyhoundsiq.com.au",
    WORKOS_REDIRECT_URI: "https://localhost:8080/callback",
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://0.0.0.0:8080/callback",
  },
  () => {
    assert.equal(resolveWorkosBaseUrl(), "https://staging.greyhoundsiq.com.au");
    assert.equal(
      resolveWorkosRedirectUri("https://0.0.0.0:8080/sign-in"),
      "https://staging.greyhoundsiq.com.au/callback"
    );
  }
);

withEnv(
  {
    NODE_ENV: "development",
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://localhost:3000/callback",
  },
  () => {
    assert.equal(
      resolveWorkosRedirectUri(),
      "http://localhost:3000/callback"
    );
  }
);

withEnv(
  {
    NODE_ENV: "development",
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://localhost:3000/callback",
  },
  () => {
    assert.equal(
      resolveWorkosRedirectUri("http://localhost:3101/sign-in"),
      "http://localhost:3101/callback"
    );
  }
);

assert.equal(resolveWorkosReturnTo(), "/feed");
assert.equal(resolveWorkosReturnTo({ plan: "unknown" }), "/feed");
assert.equal(
  resolveWorkosReturnTo({ plan: "pro" }),
  "/account?plan=pro"
);
assert.equal(
  resolveWorkosReturnTo({ interval: "yearly", plan: "pro" }),
  "/account?plan=pro&interval=yearly&checkout=continue"
);
assert.equal(
  resolveWorkosReturnTo({ interval: "weekly", plan: "pro" }),
  "/account?plan=pro"
);
assert.equal(
  resolveWorkosReturnTo({ returnTo: "/account/profile?tab=media" }),
  "/account/profile?tab=media"
);
for (const returnTo of [
  "https://attacker.example/account",
  "//attacker.example/account",
  "/sign-in?returnTo=/account",
  "/sign-in/again",
  "/callback?code=fake",
  "/callback/again",
  "/\\attacker.example/account",
]) {
  assert.equal(resolveWorkosReturnTo({ returnTo }), "/feed");
}

console.log("workos redirect tests passed");
