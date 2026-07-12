export const LAYOUT_DEBUG_ENV_KEY = "NEXT_PUBLIC_LAYOUT_DEBUG" as const;

export type LayoutDebugOverlayMode = "page" | "viewport";

export const LAYOUT_DEBUG_DEFAULT_MODE: LayoutDebugOverlayMode = "page";

export type LayoutDebugBreakpoint = "mobile" | "tablet" | "desktop";

export type LayoutDebugGrid = {
  columns: number;
  rows: number;
};

export type LayoutDebugCellLabelMode =
  | "index"
  | "coordinate"
  | "coordinate-index";

export const LAYOUT_DEBUG_BREAKPOINTS = {
  mobile: {
    minWidth: 0,
    maxWidth: 767,
  },
  tablet: {
    minWidth: 768,
    maxWidth: 1023,
  },
  desktop: {
    minWidth: 1024,
    maxWidth: Number.POSITIVE_INFINITY,
  },
} as const;

export const LAYOUT_DEBUG_GRID = {
  desktop: {
    columns: 12,
    rows: 48,
  },
  tablet: {
    columns: 8,
    rows: 64,
  },
  mobile: {
    columns: 4,
    rows: 96,
  },
} as const satisfies Record<LayoutDebugBreakpoint, LayoutDebugGrid>;

export const LAYOUT_DEBUG_LABELS = {
  enabled: true,
  mode: "coordinate-index" as LayoutDebugCellLabelMode,
  showEveryCell: true,
  zeroPadIndex: 3,
  zeroPadRowColumn: 2,
  fontSize: "clamp(7px, 0.48vw, 10px)",
  opacity: 0.72,
} as const;

export const LAYOUT_DEBUG_COLORS = {
  columnLine: "rgba(255, 0, 0, 0.18)",
  rowLine: "rgba(0, 128, 255, 0.18)",
  cellTint: "rgba(255, 255, 0, 0.025)",
  cellLabelText: "rgba(17, 24, 39, 0.72)",
  cellLabelBackground: "rgba(255, 255, 255, 0.28)",
  sectionOutline: "rgba(255, 140, 0, 0.72)",
  sectionLabelBackground: "rgba(255, 140, 0, 0.94)",
  sectionLabelText: "#111827",
  overlayLabelBackground: "rgba(17, 24, 39, 0.84)",
  overlayLabelText: "#f9fafb",
} as const;

export const LAYOUT_DEBUG_Z_INDEX = {
  sectionGuide: 2147482990,
  sectionLabel: 2147482991,
  gridOverlay: 2147483000,
  cellLabels: 2147483001,
  overlayLabel: 2147483002,
} as const;

export function isLayoutDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LAYOUT_DEBUG === "true";
}

export function getLayoutDebugBreakpoint(width?: number): LayoutDebugBreakpoint {
  const viewportWidth =
    typeof width === "number"
      ? width
      : typeof window !== "undefined"
        ? window.innerWidth
        : LAYOUT_DEBUG_BREAKPOINTS.desktop.minWidth;

  if (viewportWidth <= LAYOUT_DEBUG_BREAKPOINTS.mobile.maxWidth) {
    return "mobile";
  }

  if (viewportWidth <= LAYOUT_DEBUG_BREAKPOINTS.tablet.maxWidth) {
    return "tablet";
  }

  return "desktop";
}

export function getLayoutDebugGrid(width?: number): LayoutDebugGrid {
  return LAYOUT_DEBUG_GRID[getLayoutDebugBreakpoint(width)];
}

export function getLayoutDebugCellIndex(
  row: number,
  column: number,
  columns: number,
): number {
  return (row - 1) * columns + column;
}

export function getLayoutDebugCellLabel(
  row: number,
  column: number,
  columns: number,
  mode: LayoutDebugCellLabelMode = LAYOUT_DEBUG_LABELS.mode,
): string {
  const index = getLayoutDebugCellIndex(row, column, columns);

  const indexLabel = String(index).padStart(
    LAYOUT_DEBUG_LABELS.zeroPadIndex,
    "0",
  );

  const rowLabel = String(row).padStart(
    LAYOUT_DEBUG_LABELS.zeroPadRowColumn,
    "0",
  );

  const columnLabel = String(column).padStart(
    LAYOUT_DEBUG_LABELS.zeroPadRowColumn,
    "0",
  );

  if (mode === "index") {
    return indexLabel;
  }

  if (mode === "coordinate") {
    return `R${rowLabel}C${columnLabel}`;
  }

  return `${indexLabel} · R${rowLabel}C${columnLabel}`;
}

export function getLayoutDebugCssVariables(grid: LayoutDebugGrid = LAYOUT_DEBUG_GRID.desktop) {
  return {
    "--layout-debug-columns": String(grid.columns),
    "--layout-debug-rows": String(grid.rows),
    "--layout-debug-column-line": LAYOUT_DEBUG_COLORS.columnLine,
    "--layout-debug-row-line": LAYOUT_DEBUG_COLORS.rowLine,
    "--layout-debug-cell-tint": LAYOUT_DEBUG_COLORS.cellTint,
    "--layout-debug-cell-label-text": LAYOUT_DEBUG_COLORS.cellLabelText,
    "--layout-debug-cell-label-bg": LAYOUT_DEBUG_COLORS.cellLabelBackground,
    "--layout-debug-section-outline": LAYOUT_DEBUG_COLORS.sectionOutline,
    "--layout-debug-section-label-bg": LAYOUT_DEBUG_COLORS.sectionLabelBackground,
    "--layout-debug-section-label-text": LAYOUT_DEBUG_COLORS.sectionLabelText,
    "--layout-debug-overlay-label-bg": LAYOUT_DEBUG_COLORS.overlayLabelBackground,
    "--layout-debug-overlay-label-text": LAYOUT_DEBUG_COLORS.overlayLabelText,
    "--layout-debug-grid-z-index": String(LAYOUT_DEBUG_Z_INDEX.gridOverlay),
    "--layout-debug-cell-labels-z-index": String(LAYOUT_DEBUG_Z_INDEX.cellLabels),
    "--layout-debug-overlay-label-z-index": String(LAYOUT_DEBUG_Z_INDEX.overlayLabel),
    "--layout-debug-section-z-index": String(LAYOUT_DEBUG_Z_INDEX.sectionGuide),
    "--layout-debug-section-label-z-index": String(LAYOUT_DEBUG_Z_INDEX.sectionLabel),
  } as const;
}
