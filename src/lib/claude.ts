import { query } from "@anthropic-ai/claude-agent-sdk";
import { utter, utterIsm } from "./utter.js";
import { firstSentence, phraseTool, type VoiceHero } from "./voice.js";
import {
  asUnixMs,
  cursorAuthStatus,
  isOutOfManaText,
  loadShopFile,
  noteClaudeRateLimit,
  OutOfManaError,
  outOfManaSpeech,
  parseResetsFromText,
  saveShopPatch,
} from "./shop.js";
import { runCursorAgent } from "./cursor.js";

export interface RunAgentOpts {
  prompt: string;
  cwd: string;
  systemPrompt: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  model?: "opus" | "sonnet" | "haiku";
  maxTurns?: number;
  hero: VoiceHero;
}

function truthy(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Env for the Claude Code subprocess.
 *
 * `options.env` replaces the subprocess environment entirely, so this always
 * spreads `process.env`. Console API keys take precedence over a Pro/Max login;
 * unless `BEENS_USE_API_KEY` is set, strip them so the Agent SDK bills the
 * Claude subscription (`claude login`).
 */
function agentEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (!truthy(env.BEENS_USE_API_KEY)) {
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    delete env.ANTHROPIC_WORKSPACE_ID;
    return env;
  }
  const workspace = env.ANTHROPIC_WORKSPACE_ID?.trim();
  if (!workspace) return env;
  const extra = [
    env.ANTHROPIC_CUSTOM_HEADERS,
    `anthropic-workspace-id: ${workspace}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { ...env, ANTHROPIC_CUSTOM_HEADERS: extra };
}

function toolHint(block: Record<string, unknown>): string | undefined {
  const input = block.input;
  if (!input || typeof input !== "object") return undefined;
  const rec = input as Record<string, unknown>;
  const keys = [
    "file_path",
    "path",
    "pattern",
    "command",
    "glob",
    "query",
    "url",
  ];
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function speakSdk(hero: VoiceHero, message: unknown): void {
  const m = message as {
    type?: string;
    subtype?: string;
    status?: string | null;
    tool_name?: string;
    result?: string;
    message?: { content?: unknown };
  };
  if (m.type === "assistant") {
    const content = m.message?.content;
    if (!Array.isArray(content)) return;
    for (const raw of content) {
      if (!raw || typeof raw !== "object") continue;
      const b = raw as Record<string, unknown>;
      if (b.type === "tool_use" && typeof b.name === "string") {
        utter({
          hero,
          kind: "tool",
          line: phraseTool(hero, b.name, toolHint(b)),
          detail: b.name,
        });
      } else if (b.type === "thinking" && typeof b.thinking === "string") {
        const line = firstSentence(b.thinking);
        if (line) utter({ hero, kind: "think", line });
      }
    }
    return;
  }
  if (m.type === "tool_progress" && typeof m.tool_name === "string") {
    utter({
      hero,
      kind: "status",
      line: phraseTool(hero, m.tool_name),
      detail: m.tool_name,
    });
    return;
  }
  if (m.type === "system" && m.subtype === "status") {
    if (m.status === "compacting") {
      utter({ hero, kind: "status", line: phraseTool(hero, "Read", "compacting context") });
    } else if (m.status === "requesting") {
      utterIsm(hero);
    }
  }
}

function speakStderr(hero: VoiceHero, chunk: string): void {
  const clean = chunk.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\r\n]+/g, " ").trim();
  if (clean.length < 6 || clean.length > 140) return;
  if (/error|warn|node_modules|stack/i.test(clean) && !/ing[.…]*$/i.test(clean)) {
    return;
  }
  const stripped = clean.replace(/^[^\p{L}\p{N}]+/u, "").replace(/[….\s]+$/u, "");
  if (/ing$/i.test(stripped) || /think|ponder|consider|read|search|writ|edit|bash|compil/i.test(stripped)) {
    utterIsm(hero);
  }
}

function inspectClaudeMessage(message: unknown): OutOfManaError | Error | null {
  const m = message as {
    type?: string;
    subtype?: string;
    is_error?: boolean;
    result?: string;
    errors?: string[];
    rate_limit_info?: { status?: string; resetsAt?: number };
  };
  if (m.type === "rate_limit_event") {
    const resetsAt = asUnixMs(m.rate_limit_info?.resetsAt);
    if (m.rate_limit_info?.status === "rejected") {
      void noteClaudeRateLimit({
        status: "empty",
        resetsAt,
        detail: "Claude Pro session limit.",
      });
      return new OutOfManaError(outOfManaSpeech(resetsAt), { resetsAt });
    }
    if (m.rate_limit_info?.status === "allowed_warning") {
      void noteClaudeRateLimit({
        status: "warning",
        resetsAt,
        detail: "Claude Pro is running low.",
      });
    }
    return null;
  }
  if (m.type !== "result") return null;
  const blob = [m.result, ...(m.errors ?? [])].filter(Boolean).join("\n");
  const failed = Boolean(m.is_error) || Boolean(m.subtype && m.subtype !== "success");
  if (!failed) return null;
  if (blob && isOutOfManaText(blob)) {
    const resetsAt = parseResetsFromText(blob);
    void noteClaudeRateLimit({
      status: "empty",
      resetsAt,
      detail: blob.slice(0, 240),
    });
    return new OutOfManaError(outOfManaSpeech(resetsAt), { resetsAt });
  }
  return new Error(blob || "Claude Code returned an error result.");
}

async function runClaudeAgent(opts: RunAgentOpts): Promise<string> {
  let last = "";
  utterIsm(opts.hero);
  try {
    for await (const message of query({
      prompt: opts.prompt,
      options: {
        cwd: opts.cwd,
        systemPrompt: opts.systemPrompt,
        allowedTools: opts.allowedTools ?? [
          "Read",
          "Write",
          "Edit",
          "Glob",
          "Grep",
          "Bash",
        ],
        disallowedTools: opts.disallowedTools ?? [],
        permissionMode: "acceptEdits",
        model: opts.model ?? "sonnet",
        maxTurns: opts.maxTurns ?? 60,
        env: agentEnv(),
        stderr: (data) => speakStderr(opts.hero, data),
      },
    })) {
      speakSdk(opts.hero, message);
      const fatal = inspectClaudeMessage(message);
      if (fatal) throw fatal;
      const m = message as { type?: string; result?: string };
      if (m.type === "result" && typeof m.result === "string") last = m.result;
    }
  } catch (err) {
    if (err instanceof OutOfManaError) throw err;
    const text = err instanceof Error ? err.message : String(err);
    if (isOutOfManaText(text)) {
      const resetsAt = parseResetsFromText(text);
      await noteClaudeRateLimit({
        status: "empty",
        resetsAt,
        detail: text.slice(0, 240),
      });
      throw new OutOfManaError(outOfManaSpeech(resetsAt), { resetsAt });
    }
    throw err;
  }
  return last;
}

async function buybackOnCursor(opts: RunAgentOpts): Promise<string> {
  const cursor = await cursorAuthStatus();
  if (!cursor.ready) {
    throw new OutOfManaError(
      `${outOfManaSpeech(null)} Buyback failed — Secret Shop has no ledger.`,
    );
  }
  await saveShopPatch({ provider: "cursor" });
  utter({
    hero: "shop",
    kind: "status",
    line: "The side shop is dry. Walking to the Secret Shop.",
  });
  return runCursorAgent(opts);
}

export async function runAgent(opts: RunAgentOpts): Promise<string> {
  const shop = await loadShopFile();
  if (shop.provider === "cursor") {
    return runCursorAgent(opts);
  }
  try {
    return await runClaudeAgent(opts);
  } catch (err) {
    if (err instanceof OutOfManaError && shop.buyback) {
      return buybackOnCursor(opts);
    }
    throw err;
  }
}

/** Agents are unreliable narrators in prose but fine at writing a JSON file. */
export async function readAgentJson<T>(filePath: string): Promise<T | null> {
  const { readFile } = await import("node:fs/promises");
  try {
    const raw = await readFile(filePath, "utf8");
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    return JSON.parse(fence ? fence[1] : raw) as T;
  } catch {
    return null;
  }
}
