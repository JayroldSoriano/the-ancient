"use client";

import { useEffect, useState } from "react";
import { useHud } from "@/providers/Hud";
import { useStreamContext } from "@/providers/Stream";
import { HEROES, heroFromNode, type HeroKey } from "@/lib/roster";
import { rotateIsm, type VoiceHero } from "@/lib/isms";
import { HeroPortrait } from "./portrait";
import { cn } from "@/lib/utils";

function speakerFromHud(
  currentNode: string | null,
  action: string | null,
  utteranceHero: VoiceHero | undefined,
): VoiceHero {
  if (utteranceHero) return utteranceHero;
  if (action) return "ancient";
  return heroFromNode(currentNode) ?? "plan";
}

export function ChannelBanner() {
  const stream = useStreamContext();
  const { currentNode, action, latestUtterance } = useHud();
  const [tick, setTick] = useState(0);

  const live = stream.isLoading;
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setTick((n) => n + 1), 2400);
    return () => clearInterval(id);
  }, [live]);

  if (!live) return null;

  const hero = speakerFromHud(currentNode, action, latestUtterance?.hero);
  const name =
    hero === "ancient" ? "The Ancient" : HEROES[hero as HeroKey].hero;
  const role =
    hero === "ancient" ? "Gate" : HEROES[hero as HeroKey].role;
  const ism = rotateIsm(hero, tick);
  const doing =
    latestUtterance && Date.now() - latestUtterance.at < 12_000
      ? latestUtterance.line
      : null;

  return (
    <div className="channel-banner hud-panel scan-row flex items-stretch gap-3 overflow-hidden min-w-0 max-w-full">
      <HeroPortrait kind={hero} status="channeling" size="banner" />
      <div className="min-w-0 flex-1 py-2 pr-3">
        <div className="flex items-baseline gap-2">
          <span className="kicker">{name} · {role}</span>
          <span className="kicker text-[var(--gold-bright)]">
            channeling
            <span className="inline-flex gap-1 ml-1 align-middle">
              <span className="w-1 h-1 rounded-full bg-[var(--gold-bright)] animate-[pulse_1.2s_ease-in-out_infinite]" />
              <span className="w-1 h-1 rounded-full bg-[var(--gold-bright)] animate-[pulse_1.2s_ease-in-out_0.3s_infinite]" />
              <span className="w-1 h-1 rounded-full bg-[var(--gold-bright)] animate-[pulse_1.2s_ease-in-out_0.6s_infinite]" />
            </span>
          </span>
        </div>
        <p
          key={`${hero}-${ism}`}
          className="font-display text-lg text-[var(--gold-bright)] tracking-wide mt-1 channel-line"
        >
          {ism}
        </p>
        <p
          key={doing ?? "idle"}
          className={cn(
            "font-console text-[12px] mt-1 truncate",
            doing ? "text-[#e8dcc4]" : "text-[#5a4e3a]",
          )}
        >
          {doing ?? "The field is live."}
        </p>
      </div>
    </div>
  );
}
