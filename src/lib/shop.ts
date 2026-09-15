import fs from "node:fs/promises";
import path from "node:path";
import { SHOP_FILE } from "../config.js";

export type Vendor = "claude" | "cursor";
export type ManaStatus = "ready" | "warning" | "empty";

export class OutOfManaError extends Error {
  readonly code = "OUT_OF_MANA";
  readonly vendor: Vendor;
  readonly resetsAt: number | null;

  constructor(message: string, opts: { vendor?: Vendor; resetsAt?: number | null } = {}) {
    super(message);
    this.name = "OutOfManaError";
    this.vendor = opts.vendor ?? "claude";
    this.resetsAt = opts.resetsAt ?? null;
  }
}

type ShopFile = {
  provider?: Vendor;
  buyback?: boolean;
  claude?: {
    status?: ManaStatus;
    resetsAt?: number | null;
    detail?: string | null;
  };
};

export type ShopSnapshot = {
  provider: Vendor;
  buyback: boolean;
  claude: {
    status: ManaStatus;
    resetsAt: number | null;
    resetsLabel: string | null;
    detail: string | null;
  };
  cursor: {
    ready: boolean;
    via: "env" | "login" | "none";
    email: string | null;
    loginUrl: string | null;
    loggingIn: boolean;
    lastError: string | null;
  };
  note: string;
};

const NOTE =
  "Claude Code cannot bill Cursor. Side shop is `claude login`. Secret Shop is `@cursor/sdk` on your Cursor plan.";

let loginUrl: string | null = null;
let loginInFlight: Promise<void> | null = null;
let loginError: string | null = null;

function truthy(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function envProvider(): Vendor {
  return process.env.ANCIENT_AGENT_PROVIDER?.trim().toLowerCase() === "cursor"
    ? "cursor"
    : "claude";
}

function asVendor(value: unknown): Vendor | null {
  return value === "claude" || value === "cursor" ? value : null;
}

export function asUnixMs(value: number | undefined | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value < 1e12 ? value * 1000 : value;
}

export function formatResets(ms: number | null): string | null {
  if (!ms) return null;
  try {
    return new Date(ms).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

export function isOutOfManaText(text: string): boolean {
  return /session limit|rate.?limit|out of mana|credits_required|usage limit|hit your limit/i.test(
    text,
  );
}

export function parseResetsFromText(text: string): number | null {
  const iso = text.match(/resets?\s+(?:at\s+)?(\d{4}-\d{2}-\d{2}T[^\s]+)/i);
  if (iso) {
    const t = Date.parse(iso[1]);
    return Number.isFinite(t) ? t : null;
  }
  const clock = text.match(
    /resets?\s+(\d{1,2}):(\d{2})\s*(am|pm)?\s*(?:\(([^)]+)\))?/i,
  );
  if (!clock) return null;
  let hour = Number(clock[1]);
  const minute = Number(clock[2]);
  const ap = clock[3]?.toLowerCase();
  if (ap === "pm" && hour < 12) hour += 12;
  if (ap === "am" && hour === 12) hour = 0;
  const tz = clock[4]?.trim() || "Asia/Manila";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value;
  const y = Number(pick("year"));
  const m = Number(pick("month"));
  const d = Number(pick("day"));
  const guess = Date.parse(
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`,
  );
  if (!Number.isFinite(guess)) return null;
  return guess <= Date.now() ? guess + 24 * 60 * 60 * 1000 : guess;
}

async function readFile(): Promise<ShopFile> {
  try {
    const raw = await fs.readFile(SHOP_FILE, "utf8");
    const parsed = JSON.parse(raw) as ShopFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeFile(next: ShopFile): Promise<void> {
  await fs.mkdir(path.dirname(SHOP_FILE), { recursive: true });
  await fs.writeFile(SHOP_FILE, JSON.stringify(next, null, 2));
}

function settleClaude(stored: ShopFile["claude"]): NonNullable<ShopFile["claude"]> {
  const resetsAt = stored?.resetsAt ?? null;
  if (resetsAt && Date.now() >= resetsAt) {
    return { status: "ready", resetsAt: null, detail: null };
  }
  return {
    status: stored?.status ?? "ready",
    resetsAt,
    detail: stored?.detail ?? null,
  };
}

export async function loadShopFile(): Promise<{
  provider: Vendor;
  buyback: boolean;
  claude: NonNullable<ShopFile["claude"]>;
}> {
  const stored = await readFile();
  const claude = settleClaude(stored.claude);
  if (
    stored.claude &&
    (stored.claude.status !== claude.status ||
      stored.claude.resetsAt !== claude.resetsAt)
  ) {
    await writeFile({ ...stored, claude });
  }
  return {
    provider: asVendor(stored.provider) ?? envProvider(),
    buyback: stored.buyback ?? truthy(process.env.ANCIENT_BUYBACK),
    claude,
  };
}

export async function saveShopPatch(patch: {
  provider?: Vendor;
  buyback?: boolean;
  claude?: ShopFile["claude"];
}): Promise<void> {
  const stored = await readFile();
  await writeFile({
    ...stored,
    ...(patch.provider ? { provider: patch.provider } : {}),
    ...(patch.buyback !== undefined ? { buyback: patch.buyback } : {}),
    ...(patch.claude ? { claude: { ...stored.claude, ...patch.claude } } : {}),
  });
}

export async function noteClaudeRateLimit(opts: {
  status: ManaStatus;
  resetsAt?: number | null;
  detail?: string | null;
}): Promise<void> {
  await saveShopPatch({
    claude: {
      status: opts.status,
      resetsAt: opts.resetsAt ?? null,
      detail: opts.detail?.slice(0, 240) ?? null,
    },
  });
}

export async function cursorAuthStatus(): Promise<{
  ready: boolean;
  via: "env" | "login" | "none";
  email: string | null;
  lastError: string | null;
}> {
  if (process.env.CURSOR_API_KEY?.trim()) {
    return { ready: true, via: "env", email: null, lastError: null };
  }
  try {
    const { Cursor } = await import("@cursor/sdk");
    const status = await Cursor.auth.status();
    if (status.status === "logged-in") {
      return {
        ready: true,
        via: "login",
        email: "email" in status && typeof status.email === "string" ? status.email : null,
        lastError: loginError,
      };
    }
    return { ready: false, via: "none", email: null, lastError: loginError };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ready: false, via: "none", email: null, lastError: message.slice(0, 240) };
  }
}

export async function shopSnapshot(): Promise<ShopSnapshot> {
  const file = await loadShopFile();
  const cursor = await cursorAuthStatus();
  return {
    provider: file.provider,
    buyback: file.buyback,
    claude: {
      status: file.claude.status ?? "ready",
      resetsAt: file.claude.resetsAt ?? null,
      resetsLabel: formatResets(file.claude.resetsAt ?? null),
      detail: file.claude.detail ?? null,
    },
    cursor: {
      ready: cursor.ready,
      via: cursor.via,
      email: cursor.email,
      loginUrl,
      loggingIn: Boolean(loginInFlight),
      lastError: cursor.lastError,
    },
    note: NOTE,
  };
}

export async function setProvider(provider: Vendor): Promise<ShopSnapshot> {
  if (provider === "cursor") {
    const cursor = await cursorAuthStatus();
    if (!cursor.ready) {
      throw new Error(
        "Secret Shop has no ledger. Open the ledger (Cursor.auth.login) or set CURSOR_API_KEY — names only, do not paste the key here.",
      );
    }
  }
  await saveShopPatch({ provider });
  return shopSnapshot();
}

export async function setBuyback(buyback: boolean): Promise<ShopSnapshot> {
  await saveShopPatch({ buyback });
  return shopSnapshot();
}

export function beginCursorLogin(): { started: boolean; loginUrl: string | null } {
  if (loginInFlight) return { started: false, loginUrl };
  loginError = null;
  loginInFlight = (async () => {
    const { Cursor } = await import("@cursor/sdk");
    await Cursor.auth.login({
      apiKeyName: "the-ancient Secret Shop",
      onLoginUrl: (url: string) => {
        loginUrl = url;
      },
    });
    loginUrl = null;
    loginError = null;
  })()
    .catch((err) => {
      loginError = err instanceof Error ? err.message.slice(0, 240) : String(err);
    })
    .finally(() => {
      loginInFlight = null;
    });
  return { started: true, loginUrl };
}

export async function logoutCursor(): Promise<ShopSnapshot> {
  const { Cursor } = await import("@cursor/sdk");
  await Cursor.auth.logout();
  loginUrl = null;
  loginError = null;
  const file = await loadShopFile();
  if (file.provider === "cursor") await saveShopPatch({ provider: "claude" });
  return shopSnapshot();
}

export function outOfManaSpeech(resetsAt: number | null): string {
  const when = formatResets(resetsAt);
  return when
    ? `Out of mana. Side shop (Claude Pro) is dry until ${when} Asia/Manila. Walk to the Secret Shop (Cursor) or wait for the fountain.`
    : "Out of mana. Side shop (Claude Pro) is dry. Walk to the Secret Shop (Cursor) or wait for the fountain.";
}
