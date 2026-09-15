"use client";

import { useEffect, useState } from "react";
import { useQueryState, parseAsStringLiteral } from "nuqs";
import { useHud } from "@/providers/Hud";
import { HeroEmblem } from "./emblem";
import { useStreamContext } from "@/providers/Stream";
import { nodeLabel } from "@/lib/run-progress";
import { fetchShop, type ShopSnapshot } from "@/lib/shop";
import { cn } from "@/lib/utils";

function ShopChip() {
  const [apiUrl] = useQueryState("apiUrl");
  const [, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(["console", "field", "shop"]).withDefault("console"),
  );
  const [shop, setShop] = useState<ShopSnapshot | null>(null);

  useEffect(() => {
    const graph = apiUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:2024";
    const load = () => fetchShop(graph).then(setShop).catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [apiUrl]);

  const empty = shop?.claude.status === "empty";
  const label =
    shop?.provider === "cursor"
      ? "Secret Shop"
      : empty
        ? "Out of mana"
        : "Side shop";

  return (
    <button
      type="button"
      onClick={() => setTab("shop")}
      className={cn(
        "hidden md:flex items-center gap-2 text-left",
        empty && "text-[var(--dire)]",
      )}
      title="The Secret Shop — switch Claude / Cursor"
    >
      <span className="kicker">{label}</span>
      <div className="mana-bar w-[56px]">
        <span
          className={shop?.provider === "cursor" ? "mana-channel" : undefined}
          style={{
            width:
              shop?.provider === "cursor"
                ? "100%"
                : shop?.claude.status === "empty"
                  ? "8%"
                  : shop?.claude.status === "warning"
                    ? "28%"
                    : "100%",
          }}
        />
      </div>
    </button>
  );
}

export function TopBar() {
  const { score, elapsed, currentNode, action } = useHud();
  const stream = useStreamContext();
  const phase = action
    ? action === "approve_plan"
      ? "THE DRAFT"
      : action === "approve_work"
        ? "THE PUSH"
        : action
    : stream.isLoading
      ? nodeLabel(currentNode)
      : "AWAITING ORDERS";

  return (
    <header className="hud-bar relative z-10 grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--radiant)] shadow-[0_0_8px_#9bbf2a]" />
          <span className="kicker text-[var(--radiant)]">Radiant</span>
        </div>
        <div className="font-hud text-lg tabular-nums tracking-widest">
          <span className="text-[var(--radiant)]">{score.passed}</span>
          <span className="text-[#5a4e3a] mx-1">/</span>
          <span className="text-[var(--dire)]">{score.blocked}</span>
        </div>
        <span className="hidden md:inline kicker text-[#8a7d64]">
          {score.tasks} task{score.tasks === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <div className="flex items-center gap-3">
          <HeroEmblem kind="ancient" className="w-8 h-8" />
          <div className="text-center">
            <div className="font-display text-xl md:text-2xl tracking-[0.22em] text-[var(--gold-bright)] leading-none">
              THE ANCIENT
            </div>
            <div className="kicker mt-1">{phase}</div>
          </div>
          <div className="font-hud text-2xl tabular-nums text-[var(--gold-bright)] tracking-widest">
            {elapsed}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4">
        <ShopChip />
        <div className="text-right hidden sm:block">
          <div className="kicker">Checks</div>
          <div className="font-hud text-sm tabular-nums">
            <span className="text-[var(--radiant)]">{score.checksOk}</span>
            <span className="text-[#5a4e3a]"> · </span>
            <span className="text-[var(--dire)]">{score.checksFail}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 gold-ticker font-hud text-xl tracking-wider">
          <span className="text-[var(--gold)] text-sm">●</span>
          {score.gold.toLocaleString()}
        </div>
      </div>
    </header>
  );
}
