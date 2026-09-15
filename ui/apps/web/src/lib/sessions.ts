const KEY = "ancient:console:cleared";
const MAX = 12;

export type ClearedSession = {
  threadId: string;
  title: string;
  at: number;
};

function canStore(): boolean {
  return typeof window !== "undefined";
}

export function readCleared(): ClearedSession[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClearedSession[];
    return Array.isArray(parsed) ? parsed.filter((s) => s?.threadId) : [];
  } catch {
    return [];
  }
}

export function writeCleared(items: ClearedSession[]): ClearedSession[] {
  const next = items.slice(0, MAX);
  if (canStore()) window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function pushCleared(item: ClearedSession): ClearedSession[] {
  const prev = readCleared().filter((s) => s.threadId !== item.threadId);
  return writeCleared([item, ...prev]);
}

export function popCleared(): ClearedSession | undefined {
  const prev = readCleared();
  const [first, ...rest] = prev;
  writeCleared(rest);
  return first;
}

export function peekCleared(): ClearedSession | undefined {
  return readCleared()[0];
}

export function sessionTitle(messages: { type?: string; content?: unknown }[]): string {
  const human = messages.find((m) => m.type === "human");
  const c = human?.content;
  if (typeof c === "string" && c.trim()) return c.trim().slice(0, 80);
  if (Array.isArray(c)) {
    const text = c
      .map((part) =>
        typeof part === "string"
          ? part
          : part && typeof part === "object" && "text" in part
            ? String((part as { text?: string }).text ?? "")
            : "",
      )
      .join(" ")
      .trim();
    if (text) return text.slice(0, 80);
  }
  return "Untitled match";
}
