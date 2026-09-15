import { STAGES, type StageKey, type StageStatus } from "./roster";

export type PlanTask = {
  id?: string;
  repo?: string;
  title?: string;
  intent?: string;
  acceptanceCriteria?: string[];
  files?: string[];
  dependsOn?: string[];
};

export type WorkPlan = {
  summary?: string;
  branch?: string;
  tasks?: PlanTask[];
  risks?: string[];
  outOfScope?: string[];
};

export function asWorkPlan(value: unknown): WorkPlan | null {
  let raw: unknown = value;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("{")) return null;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.summary !== "string" && !Array.isArray(o.tasks)) return null;
  return o as WorkPlan;
}

export function prettyArg(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return value;
      }
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export type CheckResult = {
  name: string;
  cmd?: string;
  exitCode: number;
  durationMs?: number;
  tail?: string;
};

export type TaskResult = {
  taskId: string;
  repo: string;
  status: "passed" | "blocked";
  branch?: string;
  diffStat?: string;
  rounds?: number;
  checks?: CheckResult[];
  blockedReason?: string;
  evidenceDir?: string;
};

export type GraphValues = {
  request?: string;
  plan?: WorkPlan | null;
  results?: TaskResult[];
  report?: string;
  decision?: string | null;
  feedback?: string;
  prUrl?: string;
};

export function interruptAction(interrupt: unknown): string | null {
  const raw = interrupt as
    | { value?: { action_request?: { action?: string } } }
    | undefined;
  const value = raw?.value as
    | { action_request?: { action?: string } }
    | Array<{ action_request?: { action?: string } }>
    | undefined;
  const obj = Array.isArray(value) ? value[0] : value;
  return obj?.action_request?.action ?? null;
}

export function deriveStages(opts: {
  values: GraphValues;
  isLoading: boolean;
  currentNode: string | null;
  interruptAction: string | null;
}): Record<StageKey, StageStatus> {
  const { values, isLoading, currentNode, interruptAction: action } = opts;
  const plan = values.plan ?? null;
  const results = values.results ?? [];
  const passed = results.filter((r) => r.status === "passed").length;
  const blocked = results.some((r) => r.status === "blocked");
  const report = Boolean(values.report);
  const prUrl = Boolean(values.prUrl);
  const node = currentNode ?? "";

  const out = {} as Record<StageKey, StageStatus>;
  for (const s of STAGES) out[s.key] = "idle";

  const mark = (key: StageKey, status: StageStatus) => {
    out[key] = status;
  };

  if (plan) mark("plan", "ready");
  if (action === "approve_plan") mark("gate_draft", "waiting");
  else if (plan) mark("gate_draft", "ready");

  if (results.length) {
    mark("implement", "ready");
    mark("review", "ready");
    mark("evidence", blocked && !isLoading ? "fallen" : "ready");
  }
  if (report) mark("report", "ready");
  if (action === "approve_work") mark("gate_push", "waiting");
  else if (report) mark("gate_push", "ready");
  if (prUrl) mark("pr", "ready");

  const active = STAGES.find((s) => s.nodes.includes(node));
  if (isLoading && active) {
    mark(active.key, out[active.key] === "ready" ? "channeling" : "channeling");
  } else if (isLoading && !plan) {
    mark("plan", "channeling");
  }

  if (blocked && !isLoading && !report) mark("evidence", "fallen");
  if (passed && results.length) {
    /* keep ready */
  }

  return out;
}

export function scoreFrom(values: GraphValues) {
  const results = values.results ?? [];
  const checks = results.flatMap((r) => r.checks ?? []);
  return {
    passed: results.filter((r) => r.status === "passed").length,
    blocked: results.filter((r) => r.status === "blocked").length,
    tasks: values.plan?.tasks?.length ?? results.length,
    checksOk: checks.filter((c) => c.exitCode === 0).length,
    checksFail: checks.filter((c) => c.exitCode !== 0).length,
    gold: checks.filter((c) => c.exitCode === 0).length * 25,
  };
}

export type NodeLog = { at: number; node: string; label: string };

export function nodeLabel(node: string | null): string {
  if (!node) return "Idle";
  const hit = STAGES.find((s) => s.nodes.includes(node));
  return hit ? `${hit.label} · ${hit.sub}` : node;
}
