/**
 * The roster. Personas are labels and voice — they never carry operational
 * authority. Tool permissions and model routing live in the node files.
 */
export const ROSTER = {
  plan: {
    hero: "Invoker",
    title: "Kael, the Arsenal Magus",
    role: "Decomposition",
    model: "opus" as const,
    tagline: "Every request resolves into a finite set of components.",
  },
  implement: {
    hero: "Tinker",
    title: "Boush, the Artificer",
    role: "Implementation",
    model: "sonnet" as const,
    tagline: "Build, test, rearm, build again.",
  },
  review: {
    hero: "Ancient Apparition",
    title: "Kaldr, the Distant Cold",
    role: "Review",
    model: "opus" as const,
    tagline: "Judgement from outside. Only what was already broken shatters.",
  },
  evidence: {
    hero: "Clockwerk",
    title: "Rattletrap, the Cogwork Sentinel",
    role: "Verification",
    model: null, // deliberately not an agent — see nodes/evidence.ts
    tagline: "No opinions. Cogs, timers and exit codes.",
  },
  report: {
    hero: "Keeper of the Light",
    title: "Ezalor, the Illuminator",
    role: "Reporting",
    model: "opus" as const,
    tagline: "Light on what was done, and on what was not.",
  },
  pr: {
    hero: "Io",
    title: "Wisp, the Fundamental",
    role: "Delivery",
    model: null, // deterministic; the only code that reaches a remote
    tagline: "Relocate. Nothing moves until the Ancient calls it.",
  },
  oracle: {
    hero: "Oracle",
    title: "Nerif, the Oracle",
    role: "Deliberation",
    model: "sonnet" as const,
    tagline: "Two futures. Only one is finished.",
  },
  shop: {
    hero: "Arc Warden",
    title: "Zet, the Arc Warden",
    role: "Secret Shop",
    model: null,
    tagline: "Two fountains. Claude cannot spend Cursor's gold.",
  },
} as const;

/** You. Nothing crosses a gate without you. */
export const ANCIENT = "Jayrold";

export const GATES = {
  approve_plan: { name: "The Draft", hero: "Invoker" },
  approve_work: { name: "The Push", hero: "Io" },
} as const;
