"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function HomeRouteContent({
  home,
  app,
}: {
  home: ReactNode;
  app: ReactNode;
}) {
  return usePathname() === "/" ? home : app;
}
