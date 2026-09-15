import { getWriter } from "@langchain/langgraph";
import { pickIsm, type Utterance, type VoiceHero } from "./voice.js";

let lastAt = 0;
let lastLine = "";

/** Push a HUD line onto the LangGraph custom stream. No-op if custom mode is off. */
export function utter(
  partial: Omit<Utterance, "type"> & { type?: "utterance" },
): void {
  const line = partial.line.trim();
  if (!line) return;
  const now = Date.now();
  if (line === lastLine && now - lastAt < 800) return;
  if (now - lastAt < 120) return;
  lastAt = now;
  lastLine = line;
  try {
    const writer = getWriter();
    writer?.({
      type: "utterance",
      hero: partial.hero,
      kind: partial.kind,
      line,
      ...(partial.detail ? { detail: partial.detail } : {}),
    } satisfies Utterance);
  } catch {
    // HTTP counsel and other non-stream callers have no custom writer.
  }
}

export function utterIsm(hero: VoiceHero): void {
  utter({ hero, kind: "ism", line: pickIsm(hero) });
}
