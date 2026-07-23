export type DogStatisticPresentation = Readonly<{
  state: "measured" | "missing";
  text: string;
}>;

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export function formatDogPrizeMoney(
  value: number | null | undefined,
): DogStatisticPresentation {
  if (value == null || !Number.isFinite(value)) {
    return { state: "missing", text: "Not available" };
  }
  return { state: "measured", text: currencyFormatter.format(value) };
}

export function formatDogWinRate({
  wins,
  starts,
}: {
  wins: number;
  starts: number;
}): DogStatisticPresentation {
  if (
    !Number.isFinite(wins) ||
    !Number.isFinite(starts) ||
    starts <= 0 ||
    wins < 0 ||
    wins > starts
  ) {
    return { state: "missing", text: "Not available" };
  }
  return {
    state: "measured",
    text: `${((wins / starts) * 100).toFixed(1)}%`,
  };
}
