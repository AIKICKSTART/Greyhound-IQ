export type BoxColourStyle = {
  background: string;
  borderColor: string;
  color: string;
  textShadow?: string;
};

const stripedNumberShadow = "0 1px 2px rgba(0,0,0,0.88), 0 0 5px rgba(0,0,0,0.72)";
const plateNumberShadow =
  "0 1px 0 #fff, 1px 0 0 #fff, -1px 0 0 #fff, 0 -1px 0 #fff, 0 2px 4px rgba(0,0,0,0.38)";

export const AUSTRALIAN_BOX_COLOURS: Record<number, BoxColourStyle> = {
  1: {
    background: "#E3383F",
    borderColor: "rgba(255,255,255,0.22)",
    color: "#FFFFFF",
  },
  2: {
    background:
      "repeating-linear-gradient(180deg, #F8FAFC 0 6px, #F8FAFC 6px 11px, #0B0F19 11px 17px, #0B0F19 17px 23px)",
    borderColor: "rgba(255,255,255,0.36)",
    color: "#E3383F",
    textShadow: plateNumberShadow,
  },
  3: {
    background: "#F8FAFC",
    borderColor: "rgba(255,255,255,0.65)",
    color: "#111827",
  },
  4: {
    background: "#2563EB",
    borderColor: "rgba(255,255,255,0.24)",
    color: "#FFFFFF",
  },
  5: {
    background: "#FACC15",
    borderColor: "rgba(255,255,255,0.34)",
    color: "#111827",
  },
  6: {
    background: "#16A34A",
    borderColor: "rgba(255,255,255,0.24)",
    color: "#EC4899",
    textShadow: plateNumberShadow,
  },
  7: {
    background: "#111827",
    borderColor: "rgba(250,204,21,0.30)",
    color: "#FACC15",
  },
  8: {
    background: "#EC4899",
    borderColor: "rgba(255,255,255,0.24)",
    color: "#111827",
  },
  9: {
    background:
      "repeating-linear-gradient(90deg, #16A34A 0 8px, #16A34A 8px 16px, #F8FAFC 16px 24px, #F8FAFC 24px 32px)",
    borderColor: "rgba(255,255,255,0.36)",
    color: "#FFFFFF",
    textShadow: stripedNumberShadow,
  },
  10: {
    background:
      "linear-gradient(90deg, #E11D48 0 33%, #F8FAFC 33% 66%, #2563EB 66% 100%)",
    borderColor: "rgba(255,255,255,0.36)",
    color: "#111827",
  },
};

export function getBoxColourStyle(boxNumber: number): BoxColourStyle {
  return (
    AUSTRALIAN_BOX_COLOURS[boxNumber] ?? {
      background: "#4B5563",
      borderColor: "rgba(255,255,255,0.18)",
      color: "#FFFFFF",
    }
  );
}
