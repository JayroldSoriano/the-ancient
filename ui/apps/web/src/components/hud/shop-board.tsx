"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { HeroPortrait } from "./portrait";
import {
  fetchShop,
  loginShop,
  logoutShop,
  patchShop,
  type ShopSnapshot,
  type Vendor,
} from "@/lib/shop";
import { cn } from "@/lib/utils";

function manaWidth(status: ShopSnapshot["claude"]["status"]): string {
  if (status === "ready") return "100%";
  if (status === "warning") return "28%";
  return "6%";
}

function Stall({
  active,
  title,
  kicker,
  ready,
  children,
  onBuy,
  buyLabel,
  disabled,
}: {
  active: boolean;
  title: string;
  kicker: string;
  ready: boolean;
  children: ReactNode;
  onBuy: () => void;
  buyLabel: string;
  disabled?: boolean;
}) {
  return (
    <article
      className={cn(
        "border bg-[#0c0d12]/80 p-4 min-w-0",
        active ? "border-[var(--gold)]" : "border-[#3a3224]",
      )}
    >
      <p className="kicker">{kicker}</p>
      <h3 className="font-display text-xl text-[var(--gold-bright)] tracking-wide mt-1">
        {title}
      </h3>
      <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#cfc3a8]">
        {children}
      </div>
      <button
        type="button"
        className={cn(
          "hud-btn mt-4 px-3 py-1.5",
          active && "hud-btn-radiant",
        )}
        disabled={disabled || (active && ready)}
        onClick={onBuy}
      >
        {active ? "Buying here" : buyLabel}
      </button>
    </article>
  );
}

export function ShopBoard() {
  const [apiUrl] = useQueryState("apiUrl");
  const graph =
    apiUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:2024";
  const [data, setData] = useState<ShopSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchShop(graph));
    } catch (err) {
      toast.error("The Secret Shop is dark.", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [graph]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.cursor.loggingIn) return;
    const id = setInterval(() => void load(), 2500);
    return () => clearInterval(id);
  }, [data?.cursor.loggingIn, load]);

  const act = async (fn: () => Promise<ShopSnapshot>) => {
    setBusy(true);
    try {
      setData(await fn());
    } catch (err) {
      toast.error("The merchant refused.", {
        description: err instanceof Error ? err.message : String(err),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const buy = (provider: Vendor) => act(() => patchShop(graph, { provider }));

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-4 py-4">
        <div className="flex flex-col gap-5 min-w-0 pb-10 max-w-4xl">
          <div className="hud-panel flex items-stretch gap-3 p-3">
            <HeroPortrait
              kind="shop"
              status={
                data?.claude.status === "empty"
                  ? "waiting"
                  : data?.provider === "cursor"
                    ? "ready"
                    : "idle"
              }
              size="banner"
            />
            <div className="min-w-0 flex-1 py-1">
              <p className="kicker">Zet · Dual self</p>
              <h2 className="font-display text-xl text-[var(--gold-bright)] tracking-[0.18em]">
                THE SECRET SHOP
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[#cfc3a8] break-words">
                {data?.note ??
                  "Two vendors. Claude Code cannot bill Cursor. Pick a fountain."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Stall
              active={data?.provider === "claude"}
              title="Side shop"
              kicker="Claude Pro · claude login"
              ready={data?.claude.status !== "empty"}
              disabled={busy}
              buyLabel="Buy from the side shop"
              onBuy={() => void buy("claude")}
            >
              <p>
                This is the same session pool as Claude Code. When it says
                you hit your session limit, this stall is empty.
              </p>
              <div className="mana-bar w-full mt-2">
                <span
                  className={
                    data?.claude.status === "warning" ? "mana-channel" : undefined
                  }
                  style={{ width: manaWidth(data?.claude.status ?? "ready") }}
                />
              </div>
              <p className="font-console text-[12px] text-[#e8dcc4]">
                {data?.claude.status === "empty"
                  ? `Out of mana${data.claude.resetsLabel ? ` · fountain ${data.claude.resetsLabel}` : ""}`
                  : data?.claude.status === "warning"
                    ? "Mana is running low."
                    : "Mana is up."}
              </p>
              {data?.claude.detail && (
                <p className="font-console text-[11px] text-[#8a7d64] break-words">
                  {data.claude.detail}
                </p>
              )}
            </Stall>

            <Stall
              active={data?.provider === "cursor"}
              title="Secret Shop"
              kicker="Cursor plan · @cursor/sdk"
              ready={Boolean(data?.cursor.ready)}
              disabled={busy}
              buyLabel="Buy from the Secret Shop"
              onBuy={() => void buy("cursor")}
            >
              <p>
                Composer on your Cursor plan. Not a Claude login. Pipeline
                heroes still speak; the gold comes from this stall.
              </p>
              <p className="font-console text-[12px] text-[#e8dcc4]">
                {data?.cursor.ready
                  ? `Ledger is open${data.cursor.via === "env" ? " (environment)" : data.cursor.email ? ` · ${data.cursor.email}` : ""}.`
                  : "No ledger. Open it in the browser, or set CURSOR_API_KEY in beens-agents/.env — do not paste the key here."}
              </p>
              {data?.cursor.lastError && (
                <p className="font-console text-[11px] text-[var(--dire)] break-words">
                  {data.cursor.lastError}
                </p>
              )}
              {data?.cursor.loginUrl && (
                <a
                  href={data.cursor.loginUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-console text-[12px] text-[var(--mana)] break-all underline"
                >
                  Complete the ledger in the browser
                </a>
              )}
              <div className="flex flex-wrap gap-2 mt-1">
                <button
                  type="button"
                  className="hud-btn px-3 py-1.5"
                  disabled={busy || data?.cursor.loggingIn}
                  onClick={() => void act(() => loginShop(graph))}
                >
                  {data?.cursor.loggingIn ? "Waiting on the ledger…" : "Open the ledger"}
                </button>
                {data?.cursor.via === "login" && (
                  <button
                    type="button"
                    className="hud-btn px-3 py-1.5"
                    disabled={busy}
                    onClick={() => void act(() => logoutShop(graph))}
                  >
                    Close the ledger
                  </button>
                )}
              </div>
            </Stall>
          </div>

          <label className="flex items-start gap-3 hud-panel p-4 cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#c9aa71] mt-1"
              checked={Boolean(data?.buyback)}
              disabled={busy || !data}
              onChange={(e) =>
                void act(() => patchShop(graph, { buyback: e.target.checked }))
              }
            />
            <span>
              <span className="kicker">Buyback</span>
              <span className="block mt-1 text-[13px] text-[#cfc3a8] leading-relaxed">
                When the side shop is dry, spend the Secret Shop for that
                invocation and stay there. Costs Cursor gold. Off by default.
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
