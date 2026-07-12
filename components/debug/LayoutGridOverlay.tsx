"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  LAYOUT_DEBUG_BREAKPOINTS,
  LAYOUT_DEBUG_COLORS,
  LAYOUT_DEBUG_DEFAULT_MODE,
  LAYOUT_DEBUG_GRID,
  LAYOUT_DEBUG_LABELS,
  LAYOUT_DEBUG_Z_INDEX,
  getLayoutDebugCellLabel,
  getLayoutDebugCssVariables,
  getLayoutDebugGrid,
  isLayoutDebugEnabled,
  type LayoutDebugGrid,
  type LayoutDebugOverlayMode,
} from "@/lib/debug/layoutDebug";

type LayoutGridOverlayProps = {
  label?: string;
  className?: string;
  showCellLabels?: boolean;
  mode?: LayoutDebugOverlayMode;
};

function useCurrentDebugGrid(): LayoutDebugGrid {
  const [grid, setGrid] = useState<LayoutDebugGrid>(LAYOUT_DEBUG_GRID.desktop);

  useEffect(() => {
    function updateGrid() {
      setGrid(getLayoutDebugGrid(window.innerWidth));
    }

    updateGrid();
    window.addEventListener("resize", updateGrid);

    return () => {
      window.removeEventListener("resize", updateGrid);
    };
  }, []);

  return grid;
}

function getPageContentHeight(): number {
  const children = Array.from(document.body.children).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.matches('[data-layout-debug-overlay="true"], script, style')) return false;
    return true;
  });
  const bottom = children.reduce((max, el) => {
    const rect = el.getBoundingClientRect();
    return Math.max(max, rect.bottom + window.scrollY);
  }, window.innerHeight);
  return Math.ceil(Math.max(bottom, window.innerHeight));
}

function usePageHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    function update() {
      setHeight(getPageContentHeight());
    }

    update();
    window.addEventListener("resize", update);

    const ro = new ResizeObserver(update);
    Array.from(document.body.children).forEach((el) => {
      if (
        el instanceof HTMLElement &&
        !el.matches('[data-layout-debug-overlay="true"]')
      ) {
        ro.observe(el);
      }
    });

    return () => {
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, []);

  return height;
}

export function LayoutGridOverlay({
  label = "Layout debug grid",
  className = "",
  showCellLabels = LAYOUT_DEBUG_LABELS.enabled,
  mode = LAYOUT_DEBUG_DEFAULT_MODE,
}: LayoutGridOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const currentGrid = useCurrentDebugGrid();
  const pageHeight = usePageHeight();

  useEffect(() => {
    setMounted(true);
  }, []);

  const cells = useMemo(() => {
    return Array.from(
      { length: currentGrid.columns * currentGrid.rows },
      (_, index) => {
        const row = Math.floor(index / currentGrid.columns) + 1;
        const column = (index % currentGrid.columns) + 1;
        return {
          key: `${row}-${column}`,
          row,
          column,
          label: getLayoutDebugCellLabel(row, column, currentGrid.columns),
        };
      },
    );
  }, [currentGrid]);

  if (!mounted || !isLayoutDebugEnabled()) {
    return null;
  }

  const cssVariables = getLayoutDebugCssVariables(currentGrid);

  const isPageMode = mode === "page";

  const rootStyle: React.CSSProperties = {
    ...(cssVariables as React.CSSProperties),
    ...(isPageMode
      ? {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: pageHeight > 0 ? `${pageHeight}px` : "100%",
        }
      : {
          position: "fixed",
          inset: 0,
        }),
    pointerEvents: "none",
    isolation: "isolate",
    zIndex: LAYOUT_DEBUG_Z_INDEX.gridOverlay,
  };

  const overlay = (
    <>
      <style>{`
        .layout-grid-overlay::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(
              to right,
              ${LAYOUT_DEBUG_COLORS.columnLine} 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              ${LAYOUT_DEBUG_COLORS.rowLine} 1px,
              transparent 1px
            ),
            linear-gradient(
              to right,
              ${LAYOUT_DEBUG_COLORS.cellTint},
              ${LAYOUT_DEBUG_COLORS.cellTint}
            );
          background-size:
            calc(100% / ${LAYOUT_DEBUG_GRID.desktop.columns}) 100%,
            100% calc(100% / ${LAYOUT_DEBUG_GRID.desktop.rows}),
            calc(100% / ${LAYOUT_DEBUG_GRID.desktop.columns}) calc(100% / ${LAYOUT_DEBUG_GRID.desktop.rows});
          background-position: top left;
        }

        .layout-grid-overlay__label {
          position: fixed;
          top: 8px;
          right: 8px;
          padding: 4px 8px;
          border-radius: 6px;
          background: ${LAYOUT_DEBUG_COLORS.overlayLabelBackground};
          color: ${LAYOUT_DEBUG_COLORS.overlayLabelText};
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            "Liberation Mono",
            "Courier New",
            monospace;
          font-size: 11px;
          line-height: 1.35;
          z-index: ${LAYOUT_DEBUG_Z_INDEX.overlayLabel};
          white-space: pre;
          pointer-events: none;
        }

        .layout-grid-overlay__cells {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: repeat(var(--layout-debug-columns), minmax(0, 1fr));
          grid-template-rows: repeat(var(--layout-debug-rows), minmax(0, 1fr));
          z-index: ${LAYOUT_DEBUG_Z_INDEX.cellLabels};
        }

        .layout-grid-overlay__cell {
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          padding: 1px 2px;
          color: ${LAYOUT_DEBUG_COLORS.cellLabelText};
          background: ${LAYOUT_DEBUG_COLORS.cellLabelBackground};
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            "Liberation Mono",
            "Courier New",
            monospace;
          font-size: ${LAYOUT_DEBUG_LABELS.fontSize};
          line-height: 1;
          opacity: ${LAYOUT_DEBUG_LABELS.opacity};
          white-space: nowrap;
          user-select: none;
          text-shadow: 0 1px 1px rgba(255, 255, 255, 0.65);
        }

        @media (max-width: ${LAYOUT_DEBUG_BREAKPOINTS.tablet.maxWidth}px) {
          .layout-grid-overlay::before {
            background-size:
              calc(100% / ${LAYOUT_DEBUG_GRID.tablet.columns}) 100%,
              100% calc(100% / ${LAYOUT_DEBUG_GRID.tablet.rows}),
              calc(100% / ${LAYOUT_DEBUG_GRID.tablet.columns}) calc(100% / ${LAYOUT_DEBUG_GRID.tablet.rows});
          }
        }

        @media (max-width: ${LAYOUT_DEBUG_BREAKPOINTS.mobile.maxWidth}px) {
          .layout-grid-overlay::before {
            background-size:
              calc(100% / ${LAYOUT_DEBUG_GRID.mobile.columns}) 100%,
              100% calc(100% / ${LAYOUT_DEBUG_GRID.mobile.rows}),
              calc(100% / ${LAYOUT_DEBUG_GRID.mobile.columns}) calc(100% / ${LAYOUT_DEBUG_GRID.mobile.rows});
          }
        }
      `}</style>

      <div
        aria-hidden="true"
        data-layout-debug-overlay="true"
        className={["layout-grid-overlay", className].filter(Boolean).join(" ")}
        style={rootStyle}
      >
        {showCellLabels ? (
          <div className="layout-grid-overlay__cells">
            {cells.map((cell) => (
              <span
                className="layout-grid-overlay__cell"
                key={cell.key}
                title={`row ${cell.row}, column ${cell.column}`}
              >
                {cell.label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="layout-grid-overlay__label">
          {label}
          {"\n"}mode {mode}
          {"\n"}active {currentGrid.columns}c/{currentGrid.rows}r
          {"\n"}desktop {LAYOUT_DEBUG_GRID.desktop.columns}c/{LAYOUT_DEBUG_GRID.desktop.rows}r
          {"\n"}tablet {LAYOUT_DEBUG_GRID.tablet.columns}c/{LAYOUT_DEBUG_GRID.tablet.rows}r
          {"\n"}mobile {LAYOUT_DEBUG_GRID.mobile.columns}c/{LAYOUT_DEBUG_GRID.mobile.rows}r
        </div>
      </div>
    </>
  );

  return createPortal(overlay, document.body);
}
