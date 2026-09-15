import { StateGraph, START, END, Send } from "@langchain/langgraph";
import { GraphState, TaskState, type GraphStateT } from "./state.js";
import { planNode } from "./nodes/plan.js";
import { approvePlanNode, approveWorkNode } from "./nodes/gates.js";
import { implementNode } from "./nodes/implement.js";
import { reviewNode, afterReview } from "./nodes/review.js";
import { evidenceNode, afterEvidence } from "./nodes/evidence.js";
import { reportNode } from "./nodes/report.js";
import { prNode } from "./nodes/pr.js";
import { utterIsm } from "./lib/utter.js";

/**
 * Inner graph — one instance per task, running in its own git worktree.
 * implement -> judge -> (loop) -> evidence -> (loop) -> done
 *
 * Node names cannot match state channels in LangGraph 1.x (`review` is a
 * TaskState key), so the reviewer node is `judge`.
 */
const taskGraph = new StateGraph(TaskState)
  .addNode("implement", implementNode)
  .addNode("judge", reviewNode)
  .addNode("evidence", evidenceNode)
  .addEdge(START, "implement")
  .addEdge("implement", "judge")
  .addConditionalEdges("judge", afterReview, {
    implement: "implement",
    evidence: "evidence",
  })
  .addConditionalEdges("evidence", afterEvidence, {
    implement: "implement",
    __end__: END,
  })
  .compile();

/** Fan out one Send per task. Independent tasks run in parallel worktrees. */
function fanOut(state: GraphStateT) {
  const tasks = state.plan?.tasks ?? [];
  if (!tasks.length) return "summarize";
  return tasks.map(
    (task) =>
      new Send("task", {
        task,
        round: 0,
        feedback: state.feedback ?? "",
        results: [],
      }),
  );
}

const afterPlanGate = (s: GraphStateT) =>
  s.decision === "reject" ? END : "dispatch";

const afterWorkGate = (s: GraphStateT) =>
  s.decision === "approve" ? "pr" : s.decision === "revise" ? "dispatch" : END;

/** Outer graph — planning, your two gates, and the PR. */
const builder = new StateGraph(GraphState)
  .addNode("draft", planNode)
  .addNode("approve_plan", approvePlanNode)
  .addNode("dispatch", async () => {
    utterIsm("implement");
    return {};
  })
  .addNode("task", taskGraph)
  .addNode("summarize", reportNode)
  .addNode("approve_work", approveWorkNode)
  .addNode("pr", prNode)
  .addEdge(START, "draft")
  .addEdge("draft", "approve_plan")
  .addConditionalEdges("approve_plan", afterPlanGate, {
    dispatch: "dispatch",
    [END]: END,
  })
  .addConditionalEdges("dispatch", fanOut, ["task", "summarize"])
  .addEdge("task", "summarize")
  .addEdge("summarize", "approve_work")
  .addConditionalEdges("approve_work", afterWorkGate, {
    pr: "pr",
    dispatch: "dispatch",
    [END]: END,
  })
  .addEdge("pr", END);

// `langgraph dev` supplies a durable checkpointer automatically. If you run
// this standalone, compile with PostgresSaver — an interrupt that does not
// survive a restart is not a gate, it is a coin flip.
export const graph = builder.compile();
