import { Agent, JsonlLocalAgentStore } from "@cursor/sdk";
import { CURSOR_STORE } from "../config.js";
import { utter, utterIsm } from "./utter.js";
import { firstSentence, phraseTool, type VoiceHero } from "./voice.js";

type RunAgentOpts = {
  prompt: string;
  cwd: string;
  systemPrompt: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  hero: VoiceHero;
};

const TOOL_MAP: Record<string, string> = {
  Read: "read",
  Write: "edit",
  Edit: "edit",
  Glob: "glob",
  Grep: "grep",
  Bash: "shell",
  WebFetch: "webFetch",
  WebSearch: "webSearch",
  read: "read",
  edit: "edit",
  glob: "glob",
  grep: "grep",
  shell: "shell",
  webFetch: "webFetch",
  webSearch: "webSearch",
  ls: "ls",
};

const VOICE_NAME: Record<string, string> = {
  read: "Read",
  edit: "Edit",
  grep: "Grep",
  glob: "Glob",
  shell: "Bash",
  webSearch: "WebSearch",
  webFetch: "WebFetch",
  ls: "Glob",
};

let store: JsonlLocalAgentStore | null = null;

function cursorStore(): JsonlLocalAgentStore {
  store ??= new JsonlLocalAgentStore(CURSOR_STORE);
  return store;
}

function mapTools(names: string[] | undefined): string[] | undefined {
  if (!names?.length) return undefined;
  const out: string[] = [];
  for (const name of names) {
    const mapped = TOOL_MAP[name] ?? TOOL_MAP[name.replace(/^[a-z]/, (c) => c.toUpperCase())];
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out.length ? out : undefined;
}

function toolHint(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const rec = args as Record<string, unknown>;
  for (const k of ["file_path", "path", "pattern", "command", "glob", "query", "url", "targetFile"]) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function speakCursor(hero: VoiceHero, event: unknown): void {
  const e = event as {
    type?: string;
    name?: string;
    status?: string;
    args?: unknown;
    text?: string;
    message?: { content?: unknown } | string;
  };
  if (e.type === "assistant") {
    const content =
      e.message && typeof e.message === "object" ? e.message.content : undefined;
    if (!Array.isArray(content)) return;
    for (const raw of content) {
      if (!raw || typeof raw !== "object") continue;
      const b = raw as Record<string, unknown>;
      if (b.type === "tool_use" && typeof b.name === "string") {
        const name = VOICE_NAME[b.name] ?? b.name;
        utter({
          hero,
          kind: "tool",
          line: phraseTool(hero, name, toolHint(b.input)),
          detail: name,
        });
      }
    }
    return;
  }
  if (e.type === "tool_call" && typeof e.name === "string") {
    if (e.status && e.status !== "running") return;
    const name = VOICE_NAME[e.name] ?? e.name;
    utter({
      hero,
      kind: "tool",
      line: phraseTool(hero, name, toolHint(e.args)),
      detail: name,
    });
    return;
  }
  if (e.type === "thinking" && typeof e.text === "string") {
    const line = firstSentence(e.text);
    if (line) utter({ hero, kind: "think", line });
  }
}

function cursorModel(): { id: string } {
  return { id: "composer-2.5" };
}

function isSystemPromptDenied(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return /system-prompt|systemPrompt/i.test(text);
}

export async function runCursorAgent(opts: RunAgentOpts): Promise<string> {
  utterIsm(opts.hero);
  const tools = mapTools(opts.allowedTools);
  const disallowedTools = mapTools(opts.disallowedTools);
  const apiKey = process.env.CURSOR_API_KEY?.trim() || undefined;
  const base = {
    ...(apiKey ? { apiKey } : {}),
    model: cursorModel(),
    local: { cwd: opts.cwd, store: cursorStore() },
    ...(tools ? { tools } : {}),
    ...(disallowedTools ? { disallowedTools } : {}),
  };

  const tryOnce = async (systemPrompt?: string) => {
    const agent = await Agent.create({
      ...base,
      ...(systemPrompt ? { systemPrompt } : {}),
    });
    try {
      const prompt = systemPrompt
        ? opts.prompt
        : `${opts.systemPrompt}\n\n${opts.prompt}`;
      const run = await agent.send(prompt);
      for await (const event of run.stream()) {
        speakCursor(opts.hero, event);
      }
      const result = await run.wait();
      if (result.status === "error") {
        throw new Error(result.error?.message ?? "Secret Shop run failed.");
      }
      if (result.status === "cancelled") {
        throw new Error("Secret Shop run was cancelled.");
      }
      return result.result ?? "";
    } finally {
      agent.close();
    }
  };

  try {
    return await tryOnce(opts.systemPrompt);
  } catch (err) {
    if (!isSystemPromptDenied(err)) throw err;
    return await tryOnce(undefined);
  }
}
