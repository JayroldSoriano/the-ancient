"use client";

import { useHud } from "@/providers/Hud";
import { cn } from "@/lib/utils";

export function ReplayPanel() {
  const { values, nodeLog, currentNode, action, latestUtterance } = useHud();
  const tasks = values.plan?.tasks ?? [];
  const results = values.results ?? [];
  const byId = Object.fromEntries(results.map((r) => [r.taskId, r]));

  return (
    <aside className="hud-panel hidden xl:flex w-[320px] shrink-0 flex-col overflow-hidden m-2">
      <div className="px-3 py-2 border-b border-[#3a3224]">
        <div className="kicker">Replay</div>
        <h2 className="font-display text-lg text-[var(--gold-bright)] tracking-widest">
          WAR REPORT
        </h2>
        {values.plan?.branch && (
          <p className="font-console text-[11px] text-[#8a7d64] truncate">
            {values.plan.branch}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {values.plan?.summary && (
          <p className="text-[13px] leading-relaxed text-[#cfc3a8]">
            {values.plan.summary}
          </p>
        )}

        <section>
          <div className="kicker mb-2">Objectives</div>
          {tasks.length === 0 && (
            <p className="font-console text-[12px] text-[#5a4e3a]">
              No components resolved.
            </p>
          )}
          <ul className="space-y-2">
            {tasks.map((t) => {
              const res = t.id ? byId[t.id] : undefined;
              const tone =
                res?.status === "passed"
                  ? "border-[var(--radiant)]"
                  : res?.status === "blocked"
                    ? "border-[var(--dire)]"
                    : "border-[#3a3224]";
              return (
                <li
                  key={t.id ?? t.title}
                  className={cn("border-l-2 pl-2 py-1", tone)}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-hud text-[11px] uppercase tracking-widest text-[var(--gold)]">
                      {t.repo}
                    </span>
                    <span className="font-console text-[10px] text-[#8a7d64]">
                      {res?.status ?? "queued"}
                    </span>
                  </div>
                  <div className="text-[13px] text-[#e8dcc4]">{t.title}</div>
                  {res?.checks && res.checks.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {res.checks.map((c) => (
                        <div key={c.name} className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-1.5 flex-1",
                              c.exitCode === 0 ? "bg-[var(--radiant)]" : "bg-[var(--dire)]",
                            )}
                            style={{ opacity: 0.85 }}
                          />
                          <span className="font-console text-[10px] w-24 truncate text-[#8a7d64]">
                            {c.name} {c.exitCode}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {values.prUrl && (
          <a
            href={values.prUrl}
            target="_blank"
            rel="noreferrer"
            className="hud-btn hud-btn-radiant inline-flex px-3 py-2 text-center"
          >
            Relocate complete
          </a>
        )}

        <section>
          <div className="kicker mb-2">Combat log</div>
          <ol className="space-y-1 font-console text-[11px] text-[#a89878]">
            {nodeLog.length === 0 && (
              <li className="text-[#5a4e3a]">Waiting for the horn…</li>
            )}
            {nodeLog.slice(-14).map((e, i) => (
              <li
                key={`${e.at}-${e.node}-${i}`}
                className={cn(
                  "scan-row",
                  e.node === currentNode && "text-[var(--gold-bright)]",
                )}
              >
                <span className="text-[#5a4e3a] mr-2">
                  {new Date(e.at).toLocaleTimeString([], {
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                {e.label}
              </li>
            ))}
            {latestUtterance && (
              <li className="text-[var(--gold)] scan-row">
                {latestUtterance.line}
              </li>
            )}
            {action && (
              <li className="text-[var(--mana)]">
                Gate open — {action === "approve_plan" ? "The Draft" : "The Push"}
              </li>
            )}
          </ol>
        </section>
      </div>
    </aside>
  );
}
