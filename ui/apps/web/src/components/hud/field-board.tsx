"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { HeroPortrait } from "./portrait";
import {
  consultField,
  fetchField,
  issueDecreeText,
  mergeFieldCache,
  readFieldCache,
  writeFieldCache,
  type CounselPick,
  type FieldIssue,
  type FieldSnapshot,
  type Leftover,
  type RepoKey,
} from "@/lib/field";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const REPO_LABEL: Record<RepoKey, string> = {
  api: "api",
  app: "app",
  admin: "admin",
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function LeftoverCard({
  item,
  onResume,
}: {
  item: Leftover;
  onResume?: (threadId: string) => void;
}) {
  return (
    <article className="border border-[#3a3224] bg-[#0c0d12]/80 p-3 min-w-0">
      <p className="kicker">
        {item.kind}
        {item.threadId ? ` · ${item.threadId.slice(0, 8)}` : ""}
      </p>
      <h4 className="font-display text-base text-[var(--gold-bright)] mt-1 break-words">
        {item.title}
      </h4>
      <p className="mt-1 text-[13px] leading-relaxed text-[#cfc3a8] break-words">
        {item.detail}
      </p>
      <p className="mt-2 font-console text-[12px] text-[#e8dcc4] break-words">
        {item.action}
      </p>
      {item.threadId && onResume && (
        <button
          type="button"
          className="hud-btn mt-3 px-3 py-1.5"
          onClick={() => onResume(item.threadId!)}
        >
          Resume match
        </button>
      )}
    </article>
  );
}

function IssueCard({
  issue,
  recommended,
  why,
  onDecree,
}: {
  issue: FieldIssue;
  recommended?: boolean;
  why?: string;
  onDecree: (issue: FieldIssue) => void;
}) {
  return (
    <article
      className={cn(
        "border bg-[#0c0d12]/80 p-3 min-w-0",
        recommended ? "border-[var(--gold)]" : "border-[#3a3224]",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="kicker">{REPO_LABEL[issue.repo]}</span>
        <span className="font-console text-[12px] text-[#8a7d64]">
          #{issue.number}
        </span>
        <span className="font-console text-[11px] text-[#5a4e3a] ml-auto">
          {formatWhen(issue.updatedAt)}
        </span>
      </div>
      <h4 className="font-display text-lg text-[var(--gold-bright)] tracking-wide mt-1 break-words">
        {issue.title}
      </h4>
      {why && (
        <p className="mt-2 text-[13px] leading-relaxed text-[#e8dcc4] break-words">
          {why}
        </p>
      )}
      {issue.bodyPreview && !why && (
        <p className="mt-2 text-[13px] leading-relaxed text-[#cfc3a8] break-words line-clamp-3">
          {issue.bodyPreview}
        </p>
      )}
      {issue.labels.length > 0 && (
        <p className="mt-2 kicker text-[#8a7d64] normal-case tracking-normal">
          {issue.labels.join(" · ")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="hud-btn hud-btn-radiant px-3 py-1.5"
          onClick={() => onDecree(issue)}
        >
          Issue as decree
        </button>
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="hud-btn px-3 py-1.5 inline-flex items-center"
        >
          GitHub
        </a>
      </div>
    </article>
  );
}

export function FieldBoard({
  onDecree,
  onResumeThread,
}: {
  onDecree: (text: string) => void;
  onResumeThread: (threadId: string) => void;
}) {
  const [apiUrl] = useQueryState("apiUrl");
  const graph = apiUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:2024";
  const [data, setData] = useState<FieldSnapshot | null>(() => readFieldCache());
  const [loading, setLoading] = useState(() => !readFieldCache());
  const [consulting, setConsulting] = useState(false);
  const [repoFilter, setRepoFilter] = useState<RepoKey | "all">("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(mergeFieldCache(await fetchField(graph)));
    } catch (err) {
      toast.error("The Field would not open.", {
        description:
          err instanceof Error
            ? err.message
            : "Is the graph server running on port 2024?",
      });
    } finally {
      setLoading(false);
    }
  }, [graph]);

  useEffect(() => {
    if (readFieldCache()) return;
    void load();
  }, [graph, load]);

  const refreshCounsel = async () => {
    setConsulting(true);
    try {
      const force = Boolean(readFieldCache()?.counsel);
      setData(writeFieldCache(await consultField(graph, { force })));
    } catch (err) {
      toast.error("Oracle could not settle.", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setConsulting(false);
    }
  };

  const issues = data?.issues ?? [];
  const leftovers = data?.counsel?.reminders?.length
    ? data.counsel.reminders
    : (data?.leftovers ?? []);
  const ranked = data?.counsel?.ranked ?? [];
  const pick = data?.counsel?.pick ?? null;

  const byKey = useMemo(() => {
    const map = new Map<string, FieldIssue>();
    for (const issue of issues) map.set(`${issue.repo}#${issue.number}`, issue);
    return map;
  }, [issues]);

  const whyFor = (row: CounselPick) => row.why;

  const visible = issues.filter((issue) => {
    if (repoFilter !== "all" && issue.repo !== repoFilter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      issue.title.toLowerCase().includes(q) ||
      String(issue.number).includes(q) ||
      issue.labels.some((l) => l.toLowerCase().includes(q))
    );
  });

  const issueForPick = pick
    ? byKey.get(`${pick.repo}#${pick.number}`)
    : undefined;

  const oraclePane = (
    <>
      <div className="flex items-stretch gap-3 p-3 border-b border-[#3a3224]">
        <HeroPortrait
          kind="oracle"
          status={consulting ? "channeling" : leftovers.length ? "waiting" : "ready"}
          size="banner"
        />
        <div className="min-w-0 flex-1 py-1">
          <p className="kicker">Nerif · Counsel</p>
          <h2 className="font-display text-xl text-[var(--gold-bright)] tracking-[0.18em]">
            THE FIELD
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="hud-btn px-3 py-1.5"
              disabled={consulting || loading}
              onClick={() => void refreshCounsel()}
            >
              {consulting ? "Channeling…" : "Consult Oracle"}
            </button>
            <button
              type="button"
              className="hud-btn px-3 py-1.5"
              disabled={loading}
              onClick={() => void load()}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 min-w-0">
        <p className="font-display text-base text-[var(--gold-bright)] leading-snug break-words">
          {consulting
            ? "Sorting fortunes against the board…"
            : data?.counsel?.speech ??
              "Open issues across the three repos. Leftovers speak first."}
        </p>
        {data?.oracleError || data?.counsel?.error ? (
          <p className="font-console text-[11px] text-[var(--dire)] break-words">
            {data.oracleError || data.counsel?.error}
          </p>
        ) : null}
        {data?.githubError && (
          <p className="font-console text-[12px] text-[var(--dire)] break-words">
            {data.githubError}
          </p>
        )}
        {leftovers.length > 0 && (
          <section className="flex flex-col gap-3 min-w-0">
            <p className="kicker">Unpaid threads</p>
            {leftovers.map((item) => (
              <LeftoverCard
                key={item.id}
                item={item}
                onResume={onResumeThread}
              />
            ))}
          </section>
        )}
        {issueForPick && (
          <section className="flex flex-col gap-2 min-w-0">
            <p className="kicker">Oracle&apos;s pick</p>
            <IssueCard
              issue={issueForPick}
              recommended
              why={pick?.why}
              onDecree={(issue) => onDecree(issueDecreeText(issue))}
            />
          </section>
        )}
        {ranked.length > 0 && (
          <section className="flex flex-col gap-2 min-w-0">
            <p className="kicker">Suggested order</p>
            <ol className="space-y-2">
              {ranked.map((row) => {
                const issue = byKey.get(`${row.repo}#${row.number}`);
                if (!issue) return null;
                return (
                  <li key={`${row.repo}-${row.number}`}>
                    <IssueCard
                      issue={issue}
                      why={whyFor(row)}
                      onDecree={(iss) => onDecree(issueDecreeText(iss))}
                    />
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="flex-[3] min-w-0 overflow-y-auto overflow-x-hidden px-4 py-4">
        <div className="md:hidden hud-panel mb-4 flex flex-col min-h-0">
          {oraclePane}
        </div>
        <div className="flex flex-col gap-5 min-w-0 pb-10">
          <div className="flex flex-wrap items-end gap-2">
            <p className="kicker mr-auto">
              {issues.length} open issue{issues.length === 1 ? "" : "s"}
            </p>
            {(["all", "api", "app", "admin"] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={cn(
                  "hud-btn px-3 py-1.5",
                  repoFilter === key && "hud-btn-radiant",
                )}
                onClick={() => setRepoFilter(key)}
              >
                {key}
              </button>
            ))}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter title, #, label…"
              className="bg-[#0c0d12] border border-[#3a3224] font-console text-[13px] text-[#e8dcc4] px-2 py-1.5 min-w-[12rem] flex-1"
            />
          </div>
          {loading && !data && (
            <p className="font-console text-[12px] text-[#8a7d64]">
              Surveying the three repos…
            </p>
          )}
          <div className="grid gap-3 xl:grid-cols-2">
            {visible.map((issue) => (
              <IssueCard
                key={`${issue.repo}-${issue.number}`}
                issue={issue}
                onDecree={(iss) => onDecree(issueDecreeText(iss))}
              />
            ))}
          </div>
          {!loading && visible.length === 0 && (
            <p className="font-console text-[12px] text-[#5a4e3a]">
              No open issues match the filter.
            </p>
          )}
        </div>
      </div>
      <aside className="hud-panel hidden md:flex flex-[2] min-w-[20rem] flex-col overflow-hidden m-2">
        {oraclePane}
      </aside>
    </div>
  );
}
