export type HeroKey =
  | "plan"
  | "implement"
  | "review"
  | "evidence"
  | "report"
  | "pr"
  | "oracle"
  | "shop";

export type StageKey =
  | "plan"
  | "gate_draft"
  | "implement"
  | "review"
  | "evidence"
  | "report"
  | "gate_push"
  | "pr";

export type StageStatus = "idle" | "channeling" | "ready" | "waiting" | "fallen";

export const HEROES: Record<
  HeroKey,
  { hero: string; title: string; role: string; call: string; accent: string }
> = {
  plan: {
    hero: "Invoker",
    title: "Kael, the Arsenal Magus",
    role: "Draft",
    call: "Resolve the request into components.",
    accent: "#6ec8ff",
  },
  implement: {
    hero: "Tinker",
    title: "Boush, the Artificer",
    role: "Forge",
    call: "Build, test, rearm, build again.",
    accent: "#d4a017",
  },
  review: {
    hero: "Ancient Apparition",
    title: "Kaldr, the Distant Cold",
    role: "Judge",
    call: "Only what was already broken shatters.",
    accent: "#8ad4e8",
  },
  evidence: {
    hero: "Clockwerk",
    title: "Rattletrap, the Cogwork Sentinel",
    role: "Replay",
    call: "Cogs, timers and exit codes.",
    accent: "#c45c2a",
  },
  report: {
    hero: "Keeper of the Light",
    title: "Ezalor, the Illuminator",
    role: "Illuminate",
    call: "Light on what was done, and what was not.",
    accent: "#f0c14b",
  },
  pr: {
    hero: "Io",
    title: "Wisp, the Fundamental",
    role: "Relocate",
    call: "Nothing moves until the Ancient calls it.",
    accent: "#7cf0c4",
  },
  oracle: {
    hero: "Oracle",
    title: "Nerif, the Oracle",
    role: "Counsel",
    call: "Two futures. Only one is finished.",
    accent: "#6ee0c4",
  },
  shop: {
    hero: "Arc Warden",
    title: "Zet, the Arc Warden",
    role: "Secret Shop",
    call: "Two fountains. Claude cannot spend Cursor's gold.",
    accent: "#7ad0ff",
  },
};

export const STAGES: {
  key: StageKey;
  label: string;
  sub: string;
  nodes: string[];
}[] = [
  { key: "plan", label: "Invoker", sub: "Draft", nodes: ["draft", "plan"] },
  {
    key: "gate_draft",
    label: "The Draft",
    sub: "Ancient",
    nodes: ["approve_plan"],
  },
  {
    key: "implement",
    label: "Tinker",
    sub: "Forge",
    nodes: ["dispatch", "task", "implement"],
  },
  { key: "review", label: "Kaldr", sub: "Judge", nodes: ["judge", "review"] },
  {
    key: "evidence",
    label: "Rattletrap",
    sub: "Replay",
    nodes: ["evidence"],
  },
  {
    key: "report",
    label: "Ezalor",
    sub: "Illuminate",
    nodes: ["summarize", "report"],
  },
  {
    key: "gate_push",
    label: "The Push",
    sub: "Ancient",
    nodes: ["approve_work"],
  },
  { key: "pr", label: "Io", sub: "Relocate", nodes: ["pr"] },
];

export const ANCIENT = "The Ancient";

export function heroFromNode(node: string | null | undefined): HeroKey | null {
  if (!node) return null;
  const hit = STAGES.find((s) => s.nodes.includes(node));
  if (!hit) return null;
  if (hit.key === "gate_draft" || hit.key === "gate_push") return null;
  return hit.key;
}

export function heroFromMessage(text: string): HeroKey | null {
  const t = text.toLowerCase();
  if (/\binvoker\b|\bkael\b/.test(t)) return "plan";
  if (/\btinker\b|\bboush\b/.test(t)) return "implement";
  if (/\bapparition\b|\bkaldr\b/.test(t)) return "review";
  if (/\bclockwerk\b|\brattletrap\b/.test(t)) return "evidence";
  if (/\bkeeper of the light\b|\bezalor\b/.test(t)) return "report";
  if (/\bwisp\b|\brelocate\b/.test(t)) return "pr";
  if (/\boracle\b|\bnerif\b/.test(t)) return "oracle";
  if (/\barc warden\b|\bzet\b|\bsecret shop\b/.test(t)) return "shop";
  return null;
}
