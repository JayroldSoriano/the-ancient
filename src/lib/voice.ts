export type VoiceHero =
  | "plan"
  | "implement"
  | "review"
  | "evidence"
  | "report"
  | "pr"
  | "oracle"
  | "shop"
  | "ancient";

export type Utterance = {
  type: "utterance";
  hero: VoiceHero;
  kind: "ism" | "tool" | "think" | "status";
  line: string;
  detail?: string;
};

/** Original status lines in each hero's register — not Valve voicelines. */
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

const TOOL_VOICE: Record<VoiceHero, Record<string, string>> = {
  plan: {
    Read: "Consulting the grimoire",
    Grep: "Searching the catalogue",
    Glob: "Surveying the stacks",
    Write: "Inscribing the plan",
    Edit: "Revising an invocation",
    Bash: "A crude instrument — used anyway",
  },
  implement: {
    Read: "Inspecting the workpiece",
    Grep: "Scanning the shop floor",
    Glob: "Listing the parts bin",
    Write: "Forging a new piece",
    Edit: "Filing the edge",
    Bash: "Firing the shop tools",
  },
  review: {
    Read: "A cold look at the source",
    Grep: "Hunting a hairline fracture",
    Glob: "Mapping the ice",
    Write: "Carving the verdict",
    Edit: "The reviewer does not rewrite the code",
    Bash: "Unnecessary heat",
  },
  evidence: {
    Read: "Opening a log",
    Grep: "Sifting the output",
    Glob: "Finding the replay",
    Write: "Stamping the evidence",
    Edit: "The cogs do not edit",
    Bash: "Running a check",
  },
  report: {
    Read: "Reading the lantern-light",
    Grep: "Finding what was omitted",
    Glob: "Gathering the record",
    Write: "Setting the report down",
    Edit: "Trimming a shadow",
    Bash: "A spark, then the page",
  },
  pr: {
    Read: "Sensing the tether",
    Grep: "Feeling for the remote",
    Glob: "The path to origin",
    Write: "A particle of commit",
    Edit: "A shift in the current",
    Bash: "Relocate",
  },
  oracle: {
    Read: "Reading a forked fate",
    Grep: "Hunting an unpaid thread",
    Glob: "Surveying the board",
    Write: "Setting the fortune down",
    Edit: "Revising a prophecy",
    Bash: "A crude glimpse",
  },
  shop: {
    Read: "Reading the ledger",
    Grep: "Hunting a second purse",
    Glob: "Surveying both shops",
    Write: "Stamping a purchase",
    Edit: "Changing vendors",
    Bash: "Walking the path to the Secret Shop",
  },
  ancient: {
    Read: "Reviewing the field",
    Grep: "Searching the war room",
    Glob: "Surveying the map",
    Write: "A decree",
    Edit: "A correction",
    Bash: "The horn",
  },
};

export function pickIsm(hero: VoiceHero, salt = Date.now()): string {
  const pool = ISMS[hero];
  return pool[Math.abs(salt) % pool.length];
}

export function phraseTool(
  hero: VoiceHero,
  tool: string,
  hint?: string,
): string {
  const verb =
    TOOL_VOICE[hero][tool] ?? TOOL_VOICE[hero].Bash ?? `${tool}`;
  const clipped = hint?.replace(/\s+/g, " ").trim().slice(0, 72);
  return clipped ? `${verb} — ${clipped}` : verb;
}

export function firstSentence(text: string, max = 88): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  const cut = t.split(/(?<=[.!?])\s/)[0] ?? t;
  return cut.length > max ? `${cut.slice(0, max - 1)}…` : cut;
}
