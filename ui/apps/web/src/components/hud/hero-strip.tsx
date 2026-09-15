"use client";

import { STAGES, type HeroKey } from "@/lib/roster";
import { StagePortrait } from "./portrait";
import { useHud } from "@/providers/Hud";
import { rotateIsm } from "@/lib/isms";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const STATUS_LABEL: Record<string, string> = {
  idle: "benched",
  channeling: "channeling",
  ready: "ready",
  waiting: "your call",
  fallen: "fallen",
};

export function HeroStrip() {
  const { stages, currentNode, latestUtterance } = useHud();
  const [tick, setTick] = useState(0);
  const channeling = Object.values(stages).includes("channeling");

  useEffect(() => {
    if (!channeling) return;
    const id = setInterval(() => setTick((n) => n + 1), 2400);
    return () => clearInterval(id);
  }, [channeling]);

  return (
    <div className="hud-bar flex items-end justify-center gap-2 px-3 py-2 overflow-x-auto">
      {STAGES.map((stage, i) => {
        const status = stages[stage.key];
        const active = stage.nodes.includes(currentNode ?? "");
        const live = status === "channeling";
        const heroKey =
          stage.key === "gate_draft" || stage.key === "gate_push"
            ? "ancient"
            : (stage.key as HeroKey);
        const whisper =
          live
            ? latestUtterance?.line ?? rotateIsm(heroKey, tick)
            : null;

        return (
          <div key={stage.key} className="flex items-end gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "mb-7 h-px w-5 shrink-0",
                  status === "idle" ? "bg-[#3a3224]" : "bg-[var(--gold)]",
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1 min-w-[72px] max-w-[92px]">
              <span className="kicker text-[9px] tracking-[0.18em]">
                {STATUS_LABEL[status]}
              </span>
              <div
                className="hero-slot overflow-hidden"
                data-status={status}
                title={`${stage.label} — ${stage.sub}`}
              >
                <StagePortrait
                  stage={stage.key}
                  status={status}
                  className="absolute inset-0"
                />
                <div
                  className={cn(
                    "absolute bottom-0 z-10 w-full text-center text-[9px] font-hud uppercase tracking-widest py-0.5",
                    active
                      ? "bg-[var(--gold)] text-[#1a140c]"
                      : "bg-[#14120e]/90 text-[#c9aa71]",
                  )}
                >
                  {stage.label}
                </div>
              </div>
              <div className="hp-bar w-[72px]">
                <span
                  style={{
                    width:
                      status === "ready"
                        ? "100%"
                        : status === "channeling" || status === "waiting"
                          ? "62%"
                          : status === "fallen"
                            ? "8%"
                            : "0%",
                  }}
                />
              </div>
              <div className="mana-bar w-[72px]">
                <span
                  className={live ? "mana-channel" : undefined}
                  style={{
                    width:
                      status === "channeling"
                        ? "80%"
                        : status === "waiting"
                          ? "100%"
                          : status === "ready"
                            ? "45%"
                            : "12%",
                  }}
                />
              </div>
              <p
                className={cn(
                  "h-8 w-[88px] text-center font-console text-[9px] leading-tight line-clamp-2",
                  live ? "text-[var(--gold-bright)]" : "text-transparent",
                )}
              >
                {whisper ?? "\u00a0"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
