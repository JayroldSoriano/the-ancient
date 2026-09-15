import fs from "node:fs/promises";
import path from "node:path";
import { ORACLE_DIR } from "../config.js";
import { listAllIssues, type FieldIssue } from "./github.js";
import { collectLeftovers, type Leftover } from "./leftovers.js";

export type CounselPick = {
  repo: FieldIssue["repo"];
  number: number;
  title: string;
  why: string;
};

export type Counsel = {
  at: number;
  fingerprint: string;
  speech: string;
  pick: CounselPick | null;
  ranked: CounselPick[];
  reminders: Leftover[];
  error?: string;
};

export const FAILED_FORTUNE =
  "The fortune failed to settle. The leftovers still stand.";

function toPick(issue: FieldIssue, why: string): CounselPick {
  return { repo: issue.repo, number: issue.number, title: issue.title, why };
}

export function fallbackCounsel(
  issues: FieldIssue[],
  leftovers: Leftover[],
  fingerprint: string,
  error?: string,
): Counsel {
  const rankedIssues = [...issues]
    .sort((a, b) => {
      const score = (i: FieldIssue) => {
        const labels = i.labels.join(" ").toLowerCase();
        let n = 0;
        if (/\bp1\b|priority/.test(labels)) n += 4;
        if (labels.includes("status:backlog")) n -= 3;
        if (i.assignees.length) n += 1;
        return n;
      };
      const d = score(b) - score(a);
      return d !== 0 ? d : b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 8);

  const top = rankedIssues[0];
  const leftoverLine = leftovers.map((l) => l.title).join("; ");
  const speech = leftovers.length
    ? `Fate is a merchant. ${leftoverLine}. Close those before you open another.` +
      (top ? ` After that, ${top.repo}#${top.number}.` : "")
    : top
      ? `Two futures. Start with ${top.repo}#${top.number} — ${top.title}.`
      : "The board is quiet.";

  return {
    at: Date.now(),
    fingerprint,
    speech,
    pick: top
      ? toPick(
          top,
          leftovers.length
            ? "Next after the unpaid threads."
            : "Highest-signal open issue on the board.",
        )
      : null,
    ranked: rankedIssues.map((i, idx) =>
      toPick(i, idx === 0 ? "Lead on the board." : "Follows the lead."),
    ),
    reminders: leftovers,
    ...(error ? { error } : {}),
  };
}

export type FieldSnapshot = {
  issues: FieldIssue[];
  leftovers: Leftover[];
  githubError: string | null;
  fingerprint: string;
  counsel: Counsel | null;
};

const COUNSEL_FILE = "counsel.json";

export function fieldFingerprint(issues: FieldIssue[], leftovers: Leftover[]): string {
  const a = issues.map((i) => `${i.repo}#${i.number}:${i.updatedAt}`).sort().join("|");
  const b = leftovers.map((l) => l.id).sort().join("|");
  return `${a}::${b}`;
}

export async function loadCounsel(): Promise<Counsel | null> {
  try {
    const raw = await fs.readFile(path.join(ORACLE_DIR, COUNSEL_FILE), "utf8");
    const parsed = JSON.parse(raw) as Counsel;
    if (!parsed || typeof parsed.speech !== "string") return null;
    if (parsed.speech === FAILED_FORTUNE) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCounsel(counsel: Counsel): Promise<void> {
  await fs.mkdir(ORACLE_DIR, { recursive: true });
  await fs.writeFile(
    path.join(ORACLE_DIR, COUNSEL_FILE),
    JSON.stringify(counsel, null, 2),
    "utf8",
  );
}

export async function gatherField(agentsRoot: string): Promise<FieldSnapshot> {
  const [{ issues, error }, leftovers] = await Promise.all([
    listAllIssues(),
    collectLeftovers(agentsRoot),
  ]);
  const fingerprint = fieldFingerprint(issues, leftovers);
  const stored = await loadCounsel();
  return {
    issues,
    leftovers,
    githubError: error,
    fingerprint,
    counsel: stored && stored.fingerprint === fingerprint ? stored : null,
  };
}
