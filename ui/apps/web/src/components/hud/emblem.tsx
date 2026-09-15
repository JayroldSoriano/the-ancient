"use client";

import type { ReactNode } from "react";
import { HEROES, type HeroKey, type StageKey } from "@/lib/roster";

const ICONS: Record<HeroKey | "ancient", (color: string) => ReactNode> = {
  plan: (c) => (
    <g>
      <circle cx="24" cy="18" r="5" fill="#6ec8ff" />
      <circle cx="14" cy="32" r="5" fill="#d46ee8" />
      <circle cx="34" cy="32" r="5" fill="#f0a04a" />
      <path d="M24 18 L14 32 L34 32 Z" fill="none" stroke={c} strokeWidth="1.4" />
    </g>
  ),
  implement: (c) => (
    <g fill="none" stroke={c} strokeWidth="1.6">
      <circle cx="24" cy="24" r="8" />
      <path d="M24 10 v6 M24 32 v6 M10 24 h6 M32 24 h6 M14 14 l4 4 M30 30 l4 4 M34 14 l-4 4 M18 30 l-4 4" />
    </g>
  ),
  review: (c) => (
    <g fill="none" stroke={c} strokeWidth="1.5">
      <path d="M24 8 L32 28 L24 40 L16 28 Z" />
      <path d="M18 22 h12" />
      <circle cx="24" cy="18" r="2" fill={c} stroke="none" />
    </g>
  ),
  evidence: (c) => (
    <g fill="none" stroke={c} strokeWidth="1.6">
      <circle cx="24" cy="24" r="11" />
      <circle cx="24" cy="24" r="3" fill={c} stroke="none" />
      <path d="M24 13 v6 M24 29 v6 M13 24 h6 M29 24 h6" />
    </g>
  ),
  report: (c) => (
    <g fill="none" stroke={c} strokeWidth="1.5">
      <path d="M24 10 v8" />
      <path d="M16 40 h16 l-3 -10 h-10 Z" fill={c} fillOpacity="0.25" />
      <circle cx="24" cy="16" r="5" />
      <path d="M20 16 h8" />
    </g>
  ),
  pr: (c) => (
    <g fill="none" stroke={c} strokeWidth="1.5">
      <circle cx="24" cy="24" r="6" />
      <path d="M24 8 a16 16 0 0 1 0 32 a16 16 0 0 1 0 -32" />
      <path d="M12 24 h24" />
    </g>
  ),
  oracle: (c) => (
    <g fill="none" stroke={c} strokeWidth="1.5">
      <circle cx="24" cy="22" r="8" />
      <path d="M24 14 v16 M18 22 h12" />
      <path d="M16 34 h16" />
      <path d="M20 34 l4 6 4 -6" />
    </g>
  ),
  shop: (c) => (
    <g fill="none" stroke={c} strokeWidth="1.5">
      <circle cx="16" cy="22" r="7" />
      <circle cx="32" cy="22" r="7" />
      <path d="M16 29 v7 M32 29 v7 M12 36 h8 M28 36 h8" />
      <path d="M22 14 h4" />
    </g>
  ),
  ancient: (c) => (
    <g fill="none" stroke={c} strokeWidth="1.5">
      <path d="M24 8 L36 20 L32 40 H16 L12 20 Z" />
      <path d="M24 16 v16" />
      <path d="M18 28 h12" />
    </g>
  ),
};

export function HeroEmblem({
  kind,
  className,
}: {
  kind: HeroKey | "ancient";
  className?: string;
}) {
  const color =
    kind === "ancient" ? "#f0d78c" : HEROES[kind]?.accent ?? "#c9aa71";
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
    >
      {ICONS[kind](color)}
    </svg>
  );
}

export function StageEmblem({
  stage,
  className,
}: {
  stage: StageKey;
  className?: string;
}) {
  const kind: HeroKey | "ancient" =
    stage === "gate_draft" || stage === "gate_push" ? "ancient" : stage;
  return <HeroEmblem kind={kind} className={className} />;
}
