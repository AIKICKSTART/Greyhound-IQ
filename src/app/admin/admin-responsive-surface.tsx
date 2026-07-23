"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import styles from "./admin-responsive-surface.module.css";

type HeaderCell = Pick<HTMLTableCellElement, "colSpan" | "textContent" | "hidden"> & {
  getAttribute(name: string): string | null;
};

export function labelsForHeaderRow(cells: readonly HeaderCell[]) {
  const labels: string[] = [];

  for (const cell of cells) {
    const label = cell.hidden || cell.getAttribute("aria-hidden") === "true"
      ? ""
      : (cell.getAttribute("aria-label") ?? cell.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim();
    for (let column = 0; column < Math.max(cell.colSpan, 1); column += 1) {
      labels.push(label);
    }
  }

  return labels;
}

export function labelAdminTable(table: HTMLTableElement) {
  const headerRow = [...(table.tHead?.rows ?? [])]
    .reverse()
    .find((row) => row.cells.length > 0);
  if (!headerRow) return;

  const labels = labelsForHeaderRow([...headerRow.cells]);
  for (const body of table.tBodies) {
    for (const row of body.rows) {
      let column = 0;
      for (const cell of row.cells) {
        const label = [...new Set(labels.slice(column, column + cell.colSpan).filter(Boolean))]
          .join(" · ");
        if (label && cell.getAttribute("data-admin-table-label") !== label) {
          cell.setAttribute("data-admin-table-label", label);
        }
        column += cell.colSpan;
      }
    }
  }
}

function labelAdminTables(root: HTMLElement) {
  root.querySelectorAll<HTMLTableElement>("table").forEach(labelAdminTable);
}

export function AdminResponsiveSurface({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const refresh = () => labelAdminTables(root);
    const frame = requestAnimationFrame(refresh);
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname]);

  return (
    <div ref={rootRef} className={styles.surface} data-admin-responsive-surface>
      {children}
    </div>
  );
}
