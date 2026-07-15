export const RACING_STATISTIC_UNAVAILABLE_LABEL = "Not available" as const;

export type BoxBiasSourceRow = Readonly<{
  box: number;
  starts: number;
  wins: number;
  winRate: number | null;
}>;

export type BoxBiasPresentationRow = Readonly<{
  box: number;
  starts: number | null;
  wins: number | null;
  winRate: number | null;
  state: "measured" | "missing";
}>;

export function buildBoxBiasPresentation(
  rows: readonly BoxBiasSourceRow[],
  boxCount = 8,
): BoxBiasPresentationRow[] {
  const rowsByBox = new Map(
    rows
      .filter(({ box }) => Number.isInteger(box) && box >= 1 && box <= boxCount)
      .map((row) => [row.box, row]),
  );

  return Array.from({ length: boxCount }, (_, index) => {
    const box = index + 1;
    const row = rowsByBox.get(box);
    const hasMeasuredRate =
      row !== undefined &&
      row.starts > 0 &&
      row.winRate !== null &&
      Number.isFinite(row.winRate);

    return {
      box,
      starts: row?.starts ?? null,
      wins: row?.wins ?? null,
      winRate: hasMeasuredRate ? row.winRate : null,
      state: hasMeasuredRate ? "measured" : "missing",
    };
  });
}

export function formatBoxBiasRate(row: BoxBiasPresentationRow) {
  return row.winRate === null
    ? RACING_STATISTIC_UNAVAILABLE_LABEL
    : `${row.winRate}%`;
}

export function formatBoxBiasAggregateSummary(
  rows: readonly BoxBiasSourceRow[],
) {
  if (rows.length === 0) {
    return "No box-bias aggregate is available from the current read-only snapshot.";
  }

  const recordedStarts = rows.reduce(
    (total, row) =>
      Number.isFinite(row.starts) && row.starts >= 0 ? total + row.starts : total,
    0,
  );
  return `${new Intl.NumberFormat("en-AU").format(recordedStarts)} recorded starts in the current read-only box-bias snapshot.`;
}
