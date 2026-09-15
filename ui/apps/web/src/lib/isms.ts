import type { HeroKey } from "./roster";

export type VoiceHero = HeroKey | "ancient";

export type Utterance = {
  type: "utterance";
  hero: VoiceHero;
  kind: "ism" | "tool" | "think" | "status";
  line: string;
  detail?: string;
  at: number;
};

export function isUtterance(value: unknown): value is Omit<Utterance, "at"> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === "utterance" &&
    typeof v.hero === "string" &&
    typeof v.kind === "string" &&
    typeof v.line === "string"
  );
}

/** Fallback Claude-ism rotation while the graph has not yet spoken. */
export const ISMS: Record<VoiceHero, string[]> = {
  plan: [
    "Quas. Wex. Exort.",
    "Recalling a tenth invocation.",
    "Sorting orbs against the request.",
    "Purging a lesser incantation.",
    "Binding the request into components.",
    "The catalogue is not infinite. It is sufficient.",
    "Measuring what is worth keeping.",
  ],
  implement: [
    "Rearming the lathe.",
    "Another pass through the shop.",
    "Heat on the coils — compiling.",
    "March of the machines, one file at a time.",
    "Tightening a laser alignment.",
    "Build. Test. Rearm. Build again.",
    "The shop does not guess. It iterates.",
  ],
  review: [
    "Watching from outside the fight.",
    "Ice along the diff.",
    "Only the already-broken shatters.",
    "Distant cold on this change.",
    "Marking what will not survive the night.",
    "Judgement does not hurry.",
    "What was sound remains sound.",
  ],
  evidence: [
    "Cogs, not opinions.",
    "Battery of checks.",
    "Hook into the process table.",
    "Timing the exit code.",
    "The log is the only witness.",
    "If it did not exit zero, it did not pass.",
    "Replay first. Claims later.",
  ],
  report: [
    "Light on what was done.",
    "And on what was not.",
    "Illuminating the path taken.",
    "The first light of the run, written down.",
    "No shadow left for a missing check.",
    "The war report is a lantern, not a speech.",
  ],
  pr: [
    "~  ·  ~  ·  ~",
    "Tether stretching toward origin.",
    "Particles gathering.",
    "Relocate charging.",
    "Nothing moves until the Ancient calls it.",
    "The wisp does not speak. It carries.",
  ],
  oracle: [
    "Fate is a merchant. This one still owes.",
    "Two futures. Only one is finished.",
    "I have seen this omission before.",
    "The leftover is not a mystery. It is an unpaid thread.",
    "False promise: cleared, not closed.",
    "Sorting fortunes against the board.",
  ],
  shop: [
    "I am two. One purse is empty.",
    "The side shop is dry.",
    "Walk to the Secret Shop.",
    "Spark and tempest are not the same gold.",
    "Buyback spends the other fountain. Mean it.",
  ],
  ancient: [
    "The horn has not sounded.",
    "Your call, Ancient.",
    "The field waits.",
    "Nothing crosses without you.",
  ],
};

export function rotateIsm(hero: VoiceHero, tick: number): string {
  const pool = ISMS[hero];
  return pool[tick % pool.length];
}
