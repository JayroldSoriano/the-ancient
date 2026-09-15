import fs from "node:fs/promises";
import path from "node:path";
import { ORACLE_PROMPT } from "../agents.js";
import { ORACLE_DIR } from "../config.js";
import { runAgent, readAgentJson } from "../lib/claude.js";
import { sh } from "../lib/shell.js";
import {
  FAILED_FORTUNE,
  fallbackCounsel,
  fieldFingerprint,
  saveCounsel,
  type Counsel,
  type FieldSnapshot,
} from "../lib/field.js";
import type { Leftover } from "../lib/leftovers.js";

type WrittenCounsel = {
  speech?: string;
  pick?: Counsel["pick"];
  ranked?: Counsel["ranked"];
  reminders?: Leftover[];
};

function issueKey(repo: string, number: number) {
  return `${repo}#${number}`;
}

export async function consultOracle(snapshot: FieldSnapshot): Promise<Counsel> {
  const known = new Set(snapshot.issues.map((i) => issueKey(i.repo, i.number)));
  const leftoverIds = new Set(snapshot.leftovers.map((l) => l.id));
  await fs.mkdir(ORACLE_DIR, { recursive: true });
  const git = await sh("git rev-parse --is-inside-work-tree", ORACLE_DIR, {
    timeoutMs: 5_000,
  });
  if (git.exitCode !== 0) {
    await sh("git init", ORACLE_DIR, { timeoutMs: 5_000 });
  }

  await runAgent({
    prompt:
      "Field snapshot from the Ancient's board. Write counsel.json.\n\n" +
      JSON.stringify(
        {
          issues: snapshot.issues.map((i) => ({
            repo: i.repo,
            number: i.number,
            title: i.title,
            labels: i.labels,
            assignees: i.assignees,
            updatedAt: i.updatedAt,
            commentsCount: i.commentsCount,
            bodyPreview: i.bodyPreview,
          })),
          leftovers: snapshot.leftovers,
        },
        null,
        2,
      ),
    cwd: ORACLE_DIR,
    systemPrompt: ORACLE_PROMPT,
    allowedTools: ["Write"],
    disallowedTools: ["Bash", "Edit", "Read", "Grep", "Glob"],
    model: "sonnet",
    maxTurns: 8,
    hero: "oracle",
  });

  const writtenRaw = await readAgentJson<WrittenCounsel>(
    path.join(ORACLE_DIR, "counsel.json"),
  );
  const written =
    writtenRaw?.speech === FAILED_FORTUNE ? null : writtenRaw;
  if (!written?.speech && !written?.ranked?.length && !written?.pick) {
    const counsel = fallbackCounsel(
      snapshot.issues,
      snapshot.leftovers,
      fieldFingerprint(snapshot.issues, snapshot.leftovers),
    );
    await saveCounsel(counsel);
    return counsel;
  }

  const ranked = (written?.ranked ?? []).filter(
    (row) =>
      row &&
      known.has(issueKey(row.repo, row.number)) &&
      typeof row.title === "string",
  );
  let pick = written?.pick ?? null;
  if (pick && !known.has(issueKey(pick.repo, pick.number))) pick = null;

  const reminders = (written?.reminders ?? []).filter(
    (r) => r && leftoverIds.has(r.id),
  );
  const missing = snapshot.leftovers.filter(
    (l) => !reminders.some((r) => r.id === l.id),
  );

  const counsel: Counsel = {
    at: Date.now(),
    fingerprint: fieldFingerprint(snapshot.issues, snapshot.leftovers),
    speech:
      written?.speech?.trim() ||
      (snapshot.leftovers.length
        ? "A thread is still unpaid. Close it before you open another."
        : "The board is quiet. Pick from the issues yourself."),
    pick,
    ranked,
    reminders: [...reminders, ...missing],
  };
  await saveCounsel(counsel);
  return counsel;
}
