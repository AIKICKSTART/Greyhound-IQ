import assert from "node:assert/strict";
import { computeCardTier } from "./dog-card-tier";

// Elite by prize money
assert.equal(
  computeCardTier({ careerStarts: 40, careerWins: 8, winPercentage: 20, prizeMoney: 60_000 }).tier,
  "elite_legend"
);
// Elite by wins
assert.equal(
  computeCardTier({ careerStarts: 50, careerWins: 22, winPercentage: 44, prizeMoney: 10_000 }).tier,
  "elite_legend"
);
// Champion
assert.equal(
  computeCardTier({ careerStarts: 40, careerWins: 13, winPercentage: 32, prizeMoney: 15_000 }).tier,
  "champion"
);
// Top performer by strike rate
assert.equal(
  computeCardTier({ careerStarts: 10, careerWins: 5, winPercentage: 50, prizeMoney: 3_000 }).tier,
  "top_performer"
);
// Winner
assert.equal(
  computeCardTier({ careerStarts: 8, careerWins: 1, winPercentage: 12.5, prizeMoney: 900 }).tier,
  "winner"
);
// Placegetter (raced, no win)
assert.equal(
  computeCardTier({ careerStarts: 6, careerWins: 0, winPercentage: 0, prizeMoney: 0 }).tier,
  "placegetter"
);
// Prospect (never raced)
assert.equal(
  computeCardTier({ careerStarts: 0, careerWins: 0, winPercentage: 0, prizeMoney: 0 }).tier,
  "prospect"
);
// Determinism: same input → same output
const a = computeCardTier({ careerStarts: 40, careerWins: 8, winPercentage: 20, prizeMoney: 60_000 });
const b = computeCardTier({ careerStarts: 40, careerWins: 8, winPercentage: 20, prizeMoney: 60_000 });
assert.deepEqual(a, b);

console.log("dog-card-tier tests passed");
