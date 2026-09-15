"use client";

import { HeroPortrait } from "./portrait";
import type { Leftover } from "@/lib/field";

export function OracleNudge({
  leftovers,
  onOpenField,
}: {
  leftovers: Leftover[];
  onOpenField: () => void;
}) {
  if (!leftovers.length) return null;
  const first = leftovers[0];
  const extra = leftovers.length - 1;

  return (
    <button
      type="button"
      onClick={onOpenField}
      className="hud-panel mx-auto mb-2 w-full max-w-3xl flex items-stretch gap-3 overflow-hidden text-left"
    >
      <HeroPortrait kind="oracle" status="waiting" className="w-[72px] shrink-0" />
      <div className="min-w-0 flex-1 py-2 pr-3">
        <p className="kicker">Nerif · unpaid thread</p>
        <p className="font-display text-base text-[var(--gold-bright)] leading-snug break-words">
          {first.title}
        </p>
        <p className="font-console text-[12px] text-[#cfc3a8] truncate mt-0.5">
          {first.action}
          {extra > 0 ? ` · +${extra} more on The Field` : ""}
        </p>
      </div>
    </button>
  );
}
