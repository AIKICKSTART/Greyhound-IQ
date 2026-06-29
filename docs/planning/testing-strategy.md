# GreyhoundIQ — Testing Strategy v1

> Source: `docs/GreyhoundIQ-Architecture-Premium.html` + standards
> Status: Architecture spec. Tests written in parallel with feature code.
> Test framework: Vitest (unit), Playwright (e2e), k6 (load).

---

## Test pyramid

```
       ╔════════════╗
       ║   E2E      ║   10% — Playwright (5% per flow, max 30s each)
       ║  (e2e)     ║
       ╚═════╤══════╝
             │
        ╔════╧════════╗
        ║Integration ║   30% — Vitest + Supabase test project
        ║  (api/db)  ║
        ╚═════╤══════╝
              │
    ╔═════════╧═════════╗
    ║       Unit         ║   60% — Vitest, fast, no I/O
    ║    (logic)         ║
    ╚═══════════════════╝
```

---

## Test layers

### Unit tests (Vitest) — `tests/unit/**`

Pure logic, no I/O. Fast (< 10ms each). Run on every save.

**Coverage targets:**
- Domain logic: 90%
- Lib/ utilities: 85%
- Components (snapshot): 70%
- Overall: 80%

**What to test:**
- All utility functions (`cn`, date formatting, etc.)
- Pure transformation functions (normalize, validate, dedup)
- Zod schemas (every constraint edge case)
- React component rendering (key states: loading, error, empty, populated)
- Pricing calculation
- Inbreeding coefficient calculation
- Monte-Carlo simulation (deterministic with seeded random)

**Example:**
```ts
// tests/unit/breeding/coi.test.ts
import { computeCOI } from '@/lib/breeding/coi';

describe('computeCOI', () => {
  it('returns 0 for unrelated dogs', () => {
    expect(computeCOI(sire: {id: '1'}, dam: {id: '2'}, ancestors: new Map())).toBe(0);
  });

  it('returns 0.25 for full siblings', () => {
    const dad = { id: 'p1' };
    const mom = { id: 'p2' };
    const sire = { id: 's1', sire: dad, dam: mom };
    const dam = { id: 'd1', sire: dad, dam: mom };
    const ancestors = new Map([['p1', ['s1', 'd1']], ['p2', ['s1', 'd1']]]);
    expect(computeCOI(sire, dam, ancestors)).toBeCloseTo(0.25, 3);
  });
});
```

---

### Integration tests (Vitest + Supabase test project) — `tests/integration/**`

DB queries, RLS, API route handlers. Use a Supabase test project (separate from staging).

**Per-route tests:**
- 200 with valid input
- 400 with invalid input (each constraint)
- 401 unauthenticated
- 403 forbidden
- 404 not found
- 409 conflict
- 429 rate limited
- 500 server error (mocked failure)

**RLS tests:**
- User A can read own message but not User B's
- User A can update own profile but not User B's
- Admin can read all audit logs
- Service role bypasses RLS for cron jobs
- Conversation: only A and B can read
- Memory: only owner can read

**Example:**
```ts
// tests/integration/api/messages.test.ts
import { createTestUser, createTestConversation } from '@/tests/helpers';

describe('POST /api/conversations/:id/messages', () => {
  it('sends a message between two users', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const conv = await createTestConversation(alice, bob);

    const res = await fetch(`/api/conversations/${conv.id}/messages`, {
      method: 'POST',
      headers: { 'cookie': `sb-access-token=${alice.sessionToken}` },
      body: JSON.stringify({ body: 'hello' }),
    });

    expect(res.status).toBe(201);
    const msg = await res.json();
    expect(msg.body).toBe('hello');
    expect(msg.senderId).toBe(alice.id);
  });

  it('returns 403 when sender is blocked', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const conv = await createTestConversation(alice, bob);
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { blockedById: bob.id, blockedAt: new Date() },
    });

    const res = await fetch(`/api/conversations/${conv.id}/messages`, {
      method: 'POST',
      headers: { 'cookie': `sb-access-token=${alice.sessionToken}` },
      body: JSON.stringify({ body: 'hi' }),
    });

    expect(res.status).toBe(403);
  });
});
```

---

### E2E tests (Playwright) — `tests/e2e/**`

User flows across pages. Slow (< 30s each). Run on every PR.

**Critical user flows:**

1. **Signup → email verification → login → home**
2. **Search dog → view profile → add to watchlist (Phase 2)**
3. **Send message to user → recipient sees in realtime**
4. **Upload image to message → recipient sees image**
5. **Create listing → upload 3 photos → publish → view on /listings**
6. **Run race-analyst agent → get 3 picks → view pick detail**
7. **Create thread → reply → moderator agent scans → no false positive**
8. **Subscribe to Pro → Stripe checkout → tier upgrades → Pro features appear**
9. **Cancel subscription → tier downgrades to Free at period end**
10. **Account deletion → soft-delete → 30d → hard-delete → PII removed**

**Example:**
```ts
// tests/e2e/messaging.spec.ts
import { test, expect } from '@playwright/test';

test('user can send a message with image', async ({ page, context }) => {
  // Sign in
  await page.goto('/login');
  await page.fill('[name="email"]', 'alice@test.com');
  await page.fill('[name="password"]', 'test-password-12');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');

  // Find Bob in contacts
  await page.goto('/messages/new?to=bob');
  await page.fill('[data-testid="message-input"]', 'Check out Aston Queen!');
  await page.setInputFiles('[data-testid="file-input"]', 'tests/fixtures/dog.jpg');
  await page.click('[data-testid="send-button"]');

  // Verify sent
  await expect(page.locator('[data-testid="message"]').last()).toContainText('Check out Aston Queen');
  await expect(page.locator('[data-testid="message"] img').last()).toBeVisible();
});
```

---

### Load tests (k6) — `tests/load/**`

Realistic traffic patterns. Run before launch and after major changes.

**Scenarios:**

| Scenario | Users | Duration | Success criteria |
|----------|-------|----------|-------------------|
| Homepage browse | 100 concurrent | 5 min | p95 < 500ms, errors < 0.1% |
| API list (dogs, races, tracks) | 200 concurrent | 5 min | p95 < 300ms, errors < 0.1% |
| API search | 50 concurrent | 3 min | p95 < 800ms, errors < 0.5% |
| Agent run (race-analyst) | 5 concurrent | 10 min | p95 < 30s, success rate > 95% |
| Message send | 100 concurrent | 5 min | p95 < 200ms, errors < 0.1% |
| Media upload | 20 concurrent | 3 min | p95 < 3s, errors < 0.5% |
| Realtime (100 connections) | 100 concurrent | 10 min | connection drop < 1% |

**Example:**
```js
// tests/load/homepage.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '4m', target: 100 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.get('https://greyhoundiq.com.au/');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'LCP < 2.5s': (r) => r.timings.largestContentfulPaint < 2500,
  });
  sleep(1);
}
```

---

## Test infrastructure

### Supabase test project
- Separate Supabase project: `greyhoundiq-test`
- Database is reset before every test run
- Storage buckets reset
- Service role key in CI secrets

### Test helpers

```ts
// tests/helpers/db.ts
export async function resetDb() {
  // Delete in dependency order
  await prisma.messageMedia.deleteMany();
  await prisma.message.deleteMany();
  // ...
  await prisma.user.deleteMany();
}

export async function createTestUser(overrides?: Partial<User>): Promise<User> {
  return prisma.user.create({
    data: {
      supabaseUserId: faker.string.uuid(),
      email: faker.internet.email(),
      displayName: faker.person.fullName(),
      ...overrides,
    },
  });
}
```

### Mocking
- **Stripe:** `stripe-mock` for unit tests; Stripe test mode for integration
- **Hermes CLI:** Mock the `spawn` call, return canned output
- **Resend:** Capture mode in dev; mock in tests
- **Supabase Storage:** Use test bucket; auto-cleanup

---

## CI pipeline

```yaml
# .github/workflows/ci.yml (test section)
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx prisma generate

      - name: Unit tests
        run: npm run test:unit

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npx next lint

      - name: Integration tests (with Supabase)
        run: npm run test:integration
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE }}

      - name: E2E tests
        run: npx playwright test
        env:
          BASE_URL: http://localhost:3000

      - name: Build
        run: npx next build
```

---

## Manual testing checklist (pre-release)

### Smoke (every release)
- [ ] Sign up with new email
- [ ] Verify email arrives
- [ ] Click verification link
- [ ] Log in
- [ ] Log out
- [ ] Log back in
- [ ] Reset password flow
- [ ] View home page
- [ ] View each public page
- [ ] Search for a dog
- [ ] View dog profile
- [ ] View a race
- [ ] View results

### Auth (every release)
- [ ] Sign in with Google
- [ ] Sign in with magic link
- [ ] Session persists across reload
- [ ] Session expires correctly
- [ ] Sign out clears session

### Messaging (every release)
- [ ] Send text message
- [ ] Send image message
- [ ] Reply to thread (forum)
- [ ] Real-time delivery works
- [ ] Block user works
- [ ] Delete message works

### Marketplace (every release)
- [ ] Create listing
- [ ] View listing
- [ ] Renew listing
- [ ] Mark as sold
- [ ] Search listings

### Agents (every release)
- [ ] Run race-analyst
- [ ] Get 3 picks
- [ ] Cancel mid-run
- [ ] Run again — picks are consistent

### Mobile (every release)
- [ ] Open in iPhone Safari
- [ ] Open in Android Chrome
- [ ] Touch interactions work
- [ ] Forms usable
- [ ] Sheet (mobile menu) opens/closes

### Payment (every release)
- [ ] Subscribe to Pro
- [ ] Card fails → error message
- [ ] Card succeeds → tier upgrades
- [ ] Cancel subscription
- [ ] Re-subscribe

### Privacy (every release)
- [ ] Privacy policy accessible
- [ ] ToS accessible
- [ ] Account deletion works
- [ ] Data export works
- [ ] 18+ banner on every page
- [ ] Responsible gambling link works

### Performance (weekly)
- [ ] Lighthouse score > 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] LCP < 2.5s on 4G
- [ ] CLS < 0.1
- [ ] TBT < 200ms

---

## Coverage targets

| Area | Target |
|------|--------|
| Lib utilities | 90% |
| Domain logic (breeding, prediction) | 90% |
| API route handlers | 80% |
| React components | 70% |
| Overall | 80% |

CI fails if coverage drops below target.

---

## Bug bar

| Severity | Definition | Fix SLA |
|----------|-------------|---------|
| S0 (Critical) | Data loss, security breach, payment failure | < 24h |
| S1 (High) | Major feature broken, no workaround | < 3 days |
| S2 (Medium) | Feature broken, workaround exists | < 2 weeks |
| S3 (Low) | Cosmetic, minor UX issue | Next sprint |

---

## Test data management

- **No production data in tests.** Ever. Even snapshots.
- **Test data is generated** via `tests/helpers/db.ts` factories
- **Test data is reset** between runs (idempotent)
- **Test users use `+test+<n>@greyhoundiq.com.au`** so they're identifiable in logs
- **No PII in test data** — use faker for names, emails, etc.

---

## Open questions

1. **Visual regression testing** — Percy or Chromatic? Defer to post-launch.
2. **A11y testing** — axe-core via Playwright? Yes — already a CI check.
3. **Mutation testing** — Stryker? Defer to Phase 4+ if at all.
4. **Contract testing** — Pact for API contracts? Not needed for v1 (no external consumers).

---

## Pre-launch test gate

Before production launch, all of these must pass:

- [ ] All unit tests pass (100% pass rate)
- [ ] All integration tests pass
- [ ] All E2E tests pass on staging
- [ ] Lighthouse > 90 on all key pages
- [ ] Load test: 200 concurrent users, p95 < 500ms, errors < 0.1%
- [ ] Security scan: no Snyk high/critical, no OWASP top 10
- [ ] Privacy: APPs checklist complete
- [ ] Penetration test: no critical/high findings
- [ ] Manual smoke: every checkbox above
- [ ] Bug bash: 24h dogfood with 5+ internal users
