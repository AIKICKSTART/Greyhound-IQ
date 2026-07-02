import * as React from "react";

import {
  AUSTRALIAN_BOX_COLOURS as BOX_COLOURS,
  getBoxColourStyle,
  type BoxColourStyle,
} from "@/lib/box-colours";
import { cn } from "./utils";

export { BOX_COLOURS, getBoxColourStyle };
export type { BoxColourStyle };

export type GiqBoxNumberSize = "sm" | "md" | "lg";

const sizeStyles: Record<GiqBoxNumberSize, React.CSSProperties> = {
  sm: { width: 30, height: 26, fontSize: 14 },
  md: { width: 44, height: 36, fontSize: 18 },
  lg: { width: 56, height: 46, fontSize: 24 },
};

export function BoxNumber({
  box,
  size = "md",
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  box: number;
  size?: GiqBoxNumberSize;
}) {
  return (
    <span
      className={cn("giq-box-plate", className)}
      style={{ ...getBoxColourStyle(box), ...sizeStyles[size], ...style }}
      {...props}
    >
      {box}
    </span>
  );
}
