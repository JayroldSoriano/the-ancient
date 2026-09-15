import path from "node:path";
import { AIMessage } from "@langchain/core/messages";
import { REPOS } from "../config.js";
import { LEAD_PROMPT } from "../agents.js";
import { runAgent, readAgentJson } from "../lib/claude.js";
import type { GraphStateT, WorkPlan } from "../state.js";

export async function planNode(state: GraphStateT) {
  const request =
    state.request ||
    String(state.messages.at(-1)?.content ?? "").trim();

  // The lead reads across repos but writes only its plan file.
  const cwd = REPOS.api.dir;
  await runAgent({
    prompt: `Request from Jayrold:\n\n${request}\n\nProduce the plan.`,
    cwd,
    systemPrompt: LEAD_PROMPT,
    allowedTools: ["Read", "Glob", "Grep", "Write"],
    model: "opus",
    hero: "plan",
  });

  const plan = await readAgentJson<WorkPlan>(
    path.join(cwd, ".agent/plan.json"),
  );
  if (!plan) throw new Error("Lead agent did not produce a readable plan.");

  const lines = plan.tasks
    .map((t) => `- [${t.repo}] ${t.title} (${t.id})`)
    .join("\n");

  return {
    request,
    plan,
    messages: [
      new AIMessage(
        `**Invoker — ${plan.branch}**\n\n${plan.summary}\n\n${lines}\n\n` +
          (plan.risks.length ? `Risks:\n${plan.risks.map((r) => `- ${r}`).join("\n")}` : ""),
      ),
    ],
  };
}
