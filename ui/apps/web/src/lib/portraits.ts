import type { HeroKey, StageKey } from "./roster";

const CDN = "https://cdn.steamstatic.com/apps/dota2/images/heroes";
const REACT = "https://cdn.steamstatic.com/apps/dota2/images/dota_react/heroes";
const WORKSHOP = "https://www.dota2.com/workshop/requirements";

export type Portrait = {
  slug: string;
  /** Workshop grid portrait (`_lg.png` on the requirements page). */
  wide: string;
  /** Vertical pick portrait — fills the HUD slot. */
  vert: string;
  /** Wide crop used while the hero is channeling. */
  crop: string;
  workshop?: string;
};

function heroPortrait(slug: string): Portrait {
  return {
    slug,
    wide: `${CDN}/${slug}_lg.png`,
    vert: `${CDN}/${slug}_vert.jpg`,
    crop: `${REACT}/crops/${slug}.png`,
    workshop: `${WORKSHOP}/${slug}`,
  };
}

/** Same Valve CDN images the workshop requirements grid uses. */
export const PORTRAITS: Record<HeroKey, Portrait> = {
  plan: heroPortrait("invoker"),
  implement: heroPortrait("tinker"),
  review: heroPortrait("ancient_apparition"),
  evidence: heroPortrait("rattletrap"),
  report: heroPortrait("keeper_of_the_light"),
  pr: heroPortrait("wisp"),
  oracle: heroPortrait("oracle"),
  shop: heroPortrait("arc_warden"),
};

export function portraitFor(stage: StageKey): Portrait | null {
  if (stage === "gate_draft" || stage === "gate_push") return null;
  return PORTRAITS[stage];
}
