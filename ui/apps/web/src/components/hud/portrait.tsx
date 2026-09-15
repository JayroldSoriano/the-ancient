"use client";

import { PORTRAITS, portraitFor } from "@/lib/portraits";
import { HEROES, type HeroKey, type StageKey } from "@/lib/roster";
import { HeroEmblem } from "./emblem";
import { cn } from "@/lib/utils";

export function HeroPortrait({
  kind,
  status,
  className,
  size = "slot",
}: {
  kind: HeroKey | "ancient";
  status?: string;
  className?: string;
  size?: "slot" | "banner";
}) {
  if (kind === "ancient") {
    return (
      <div
        className={cn(
          "hero-portrait hero-portrait-ancient flex items-center justify-center",
          className,
        )}
        data-status={status}
        data-size={size}
      >
        <HeroEmblem kind="ancient" className={size === "banner" ? "w-16 h-16" : "w-10 h-10"} />
      </div>
    );
  }

  const art = PORTRAITS[kind];
  const src = size === "banner" ? art.crop : art.vert;
  const label = HEROES[kind].hero;

  return (
    <div
      className={cn("hero-portrait", className)}
      data-status={status}
      data-size={size}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        title={`${label} — Dota 2 workshop reference`}
        className="hero-portrait-img"
        draggable={false}
        onError={(e) => {
          const el = e.currentTarget;
          if (el.src !== art.wide) el.src = art.wide;
        }}
      />
    </div>
  );
}

export function StagePortrait({
  stage,
  status,
  className,
}: {
  stage: StageKey;
  status?: string;
  className?: string;
}) {
  const portrait = portraitFor(stage);
  if (!portrait || stage === "gate_draft" || stage === "gate_push") {
    return <HeroPortrait kind="ancient" status={status} className={className} />;
  }
  return <HeroPortrait kind={stage} status={status} className={className} />;
}
