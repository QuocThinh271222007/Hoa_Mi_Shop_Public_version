"use client";

import type { CSSProperties, ElementType, ReactNode } from "react";
import {
  LAYOUT_DEBUG_COLORS,
  LAYOUT_DEBUG_Z_INDEX,
  isLayoutDebugEnabled,
} from "@/lib/debug/layoutDebug";

type SectionGuideProps = {
  name: string;
  children: ReactNode;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
};

export function SectionGuide({
  name,
  children,
  as: Component = "section",
  className = "",
  style,
}: SectionGuideProps) {
  const debugEnabled = isLayoutDebugEnabled();

  if (!debugEnabled) {
    return <>{children}</>;
  }

  const guideStyle: CSSProperties = {
    ...style,
    position: "relative",
    outline: `1px dashed ${LAYOUT_DEBUG_COLORS.sectionOutline}`,
    outlineOffset: "-1px",
  };

  const labelStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    transform: "translateY(-100%)",
    padding: "2px 6px",
    borderRadius: "4px 4px 0 0",
    background: LAYOUT_DEBUG_COLORS.sectionLabelBackground,
    color: LAYOUT_DEBUG_COLORS.sectionLabelText,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 11,
    lineHeight: 1.35,
    pointerEvents: "none",
    zIndex: LAYOUT_DEBUG_Z_INDEX.sectionLabel,
    whiteSpace: "nowrap",
  };

  return (
    <Component className={className} style={guideStyle} data-section-guide={name}>
      <span aria-hidden="true" style={labelStyle}>
        Section: {name}
      </span>
      {children}
    </Component>
  );
}
