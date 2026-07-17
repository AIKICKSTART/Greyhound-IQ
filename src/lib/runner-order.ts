export type RunnerTailSort = "finish" | "box" | "time" | "name";

type OrderableRunner = {
  boxNumber: number;
  scratched: boolean;
  dog: { name: string };
  result: {
    finishingPosition: number | null;
    runningTime: number | null;
  } | null;
};

export function orderRunners<T extends OrderableRunner>(
  runners: readonly T[],
  tailSort: RunnerTailSort = "finish"
) {
  return [...runners].sort((left, right) =>
    compareRunners(left, right, tailSort)
  );
}

function compareRunners(
  left: OrderableRunner,
  right: OrderableRunner,
  tailSort: RunnerTailSort
) {
  const leftPodium = podiumPosition(left);
  const rightPodium = podiumPosition(right);
  if (leftPodium !== rightPodium) return leftPodium - rightPodium;
  if (leftPodium < 4) return left.boxNumber - right.boxNumber;

  const bucketDifference = tailBucket(left) - tailBucket(right);
  if (bucketDifference !== 0) return bucketDifference;

  const tailDifference = compareTail(left, right, tailSort);
  return tailDifference || left.boxNumber - right.boxNumber;
}

function podiumPosition(runner: OrderableRunner) {
  const position = runner.result?.finishingPosition;
  return !runner.scratched && position != null && position >= 1 && position <= 3
    ? position
    : 4;
}

function tailBucket(runner: OrderableRunner) {
  if (runner.scratched) return 2;
  return officialPosition(runner) == null ? 1 : 0;
}

function compareTail(
  left: OrderableRunner,
  right: OrderableRunner,
  tailSort: RunnerTailSort
) {
  if (tailSort === "box") return left.boxNumber - right.boxNumber;
  if (tailSort === "time") {
    return sortableNumber(left.result?.runningTime) - sortableNumber(right.result?.runningTime);
  }
  if (tailSort === "name") {
    return left.dog.name.localeCompare(right.dog.name, "en-AU", {
      sensitivity: "base",
    });
  }
  return sortableNumber(officialPosition(left)) - sortableNumber(officialPosition(right));
}

function officialPosition(runner: OrderableRunner) {
  const position = runner.result?.finishingPosition;
  return position != null && position > 0 ? position : null;
}

function sortableNumber(value: number | null | undefined) {
  return value == null ? Number.POSITIVE_INFINITY : value;
}
