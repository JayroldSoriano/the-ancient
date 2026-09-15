import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { RepoKey } from "./config.js";

export interface Task {
  id: string;
  repo: RepoKey;
  title: string;
  intent: string;
  acceptanceCriteria: string[];
  files: string[];
  dependsOn: string[];
}

export interface WorkPlan {
  summary: string;
  branch: string;
  tasks: Task[];
  risks: string[];
  outOfScope: string[];
}

export interface ReviewVerdict {
  verdict: "approved" | "changes_requested";
  blocking: { file: string; line?: number; issue: string; fix: string }[];
  notes: string[];
}

export interface CheckResult {
  name: string;
  cmd: string;
  exitCode: number;
  durationMs: number;
  logPath: string;
  tail: string;
}

export interface TaskResult {
  taskId: string;
  repo: RepoKey;
  status: "passed" | "blocked";
  branch: string;
  worktree: string;
  diffStat: string;
  rounds: number;
  review: ReviewVerdict | null;
  checks: CheckResult[];
  evidenceDir: string;
  blockedReason?: string;
}

/** Outer graph: owns the plan, the human gates, and the PR. */
export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  request: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  plan: Annotation<WorkPlan | null>({ reducer: (_, b) => b, default: () => null }),
  // Passing [] clears the list — used when you send work back for revision.
  results: Annotation<TaskResult[]>({
    reducer: (a, b) => (b.length === 0 ? [] : [...a, ...b]),
    default: () => [],
  }),
  report: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  decision: Annotation<"approve" | "revise" | "reject" | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  feedback: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  prUrl: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
});
export type GraphStateT = typeof GraphState.State;

/** Inner graph: one instance per task, fanned out with Send. */
export const TaskState = Annotation.Root({
  task: Annotation<Task>({ reducer: (_, b) => b }),
  branch: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  worktree: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  round: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  review: Annotation<ReviewVerdict | null>({ reducer: (_, b) => b, default: () => null }),
  checks: Annotation<CheckResult[]>({ reducer: (_, b) => b, default: () => [] }),
  feedback: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  results: Annotation<TaskResult[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
});
export type TaskStateT = typeof TaskState.State;
