import { interrupt } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { GATES } from "../roster.js";
import { utterIsm } from "../lib/utter.js";
import type { GraphStateT } from "../state.js";

/**
 * Gate 1 — you approve the plan before a single agent touches code.
 * The payload uses the HumanInterrupt shape that Agent Chat UI renders
 * natively as accept / edit / respond / ignore controls.
 */
export async function approvePlanNode(state: GraphStateT) {
  utterIsm("ancient");
  const decision = interrupt({
    action_request: {
      action: "approve_plan",
      args: { plan: state.plan },
    },
    config: {
      allow_accept: true,
      allow_edit: true,
      allow_respond: true,
      allow_ignore: true,
    },
    description:
      `${GATES.approve_plan.name} — Invoker has resolved the request into ` +
      "components. Nothing is forged until you accept. Edit the JSON to " +
      "change scope, or respond with instructions.",
  }) as { type: string; args?: unknown };

  if (decision.type === "ignore") {
    return { decision: "reject" as const, messages: [new AIMessage("Draft cancelled. Nothing was forged.")] };
  }
  if (decision.type === "edit") {
    return { plan: (decision.args as { plan: GraphStateT["plan"] }).plan };
  }
  if (decision.type === "response") {
    return { feedback: String(decision.args ?? "") };
  }
  return {};
}

/**
 * Gate 2 — you approve the finished work against the evidence bundle.
 * Only after this does anything reach a remote.
 */
export async function approveWorkNode(state: GraphStateT) {
  utterIsm("ancient");
  const decision = interrupt({
    action_request: {
      action: "approve_work",
      args: {
        report: state.report,
        results: state.results.map((r) => ({
          task: r.taskId,
          repo: r.repo,
          status: r.status,
          rounds: r.rounds,
          diff: r.diffStat,
          checks: r.checks.map((c) => `${c.name}: exit ${c.exitCode}`),
          evidence: r.evidenceDir,
        })),
      },
    },
    config: {
      allow_accept: true,
      allow_edit: false,
      allow_respond: true,
      allow_ignore: true,
    },
    description:
      `${GATES.approve_work.name} — Kaldr has passed it and Rattletrap has ` +
      "the replay. Accept and Io relocates it to the remote. Respond to send " +
      "it back to Boush. Ignore to abandon the run.",
  }) as { type: string; args?: unknown };

  if (decision.type === "accept") return { decision: "approve" as const };
  if (decision.type === "ignore") return { decision: "reject" as const };
  return {
    decision: "revise" as const,
    feedback: String(decision.args ?? ""),
    results: [],
  };
}
