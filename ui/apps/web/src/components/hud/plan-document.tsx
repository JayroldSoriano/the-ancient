"use client";

import { asWorkPlan, type PlanTask, type WorkPlan } from "@/lib/run-progress";
import { cn } from "@/lib/utils";

function TaskCard({ task, index }: { task: PlanTask; index: number }) {
  const criteria = task.acceptanceCriteria ?? [];
  const files = task.files ?? [];
  const deps = task.dependsOn ?? [];

  return (
    <article className="border border-[#3a3224] bg-[#0c0d12]/80 p-3 min-w-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="kicker">
          {String(index + 1).padStart(2, "0")}
          {task.id ? ` · ${task.id}` : ""}
        </span>
        {task.repo && (
          <span className="font-hud text-[11px] uppercase tracking-widest text-[var(--gold)]">
            {task.repo}
          </span>
        )}
      </div>
      {task.title && (
        <h4 className="font-display text-lg text-[var(--gold-bright)] tracking-wide mt-1 break-words">
          {task.title}
        </h4>
      )}
      {task.intent && (
        <p className="mt-2 text-[13px] leading-relaxed text-[#e8dcc4] break-words">
          {task.intent}
        </p>
      )}
      {criteria.length > 0 && (
        <div className="mt-3">
          <p className="kicker mb-1">Must hold</p>
          <ul className="list-disc pl-5 space-y-1.5 text-[13px] leading-relaxed text-[#cfc3a8]">
            {criteria.map((c, i) => (
              <li key={i} className="break-words">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {files.length > 0 && (
        <div className="mt-3">
          <p className="kicker mb-1">Files</p>
          <ul className="font-console text-[11px] text-[#a89878] space-y-0.5">
            {files.map((f) => (
              <li key={f} className="break-all">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
      {deps.length > 0 && (
        <p className="mt-2 kicker text-[#8a7d64]">
          After {deps.join(", ")}
        </p>
      )}
    </article>
  );
}

function NoteList({
  title,
  items,
  tone = "gold",
}: {
  title: string;
  items: string[];
  tone?: "gold" | "dire";
}) {
  if (!items.length) return null;
  return (
    <section className="min-w-0">
      <p className="kicker mb-2">{title}</p>
      <ul
        className={cn(
          "list-disc pl-5 space-y-2 text-[13px] leading-relaxed break-words",
          tone === "dire" ? "text-[#e8b4aa]" : "text-[#cfc3a8]",
        )}
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function PlanDocument({
  value,
  className,
}: {
  value: unknown;
  className?: string;
}) {
  const plan = asWorkPlan(value);
  if (!plan) return null;
  const tasks = plan.tasks ?? [];

  return (
    <div className={cn("flex flex-col gap-5 min-w-0 max-w-full", className)}>
      {plan.branch && (
        <p className="font-console text-[12px] text-[#8a7d64] break-all">
          {plan.branch}
        </p>
      )}
      {plan.summary && (
        <p className="text-[14px] leading-relaxed text-[#e8dcc4] break-words">
          {plan.summary}
        </p>
      )}
      {tasks.length > 0 && (
        <section className="flex flex-col gap-3 min-w-0">
          <p className="kicker">
            {tasks.length} component{tasks.length === 1 ? "" : "s"}
          </p>
          {tasks.map((task, i) => (
            <TaskCard key={task.id ?? `${task.title}-${i}`} task={task} index={i} />
          ))}
        </section>
      )}
      <NoteList title="Risks" items={plan.risks ?? []} tone="dire" />
      <NoteList title="Out of scope" items={plan.outOfScope ?? []} />
    </div>
  );
}

export function isRenderablePlan(value: unknown): boolean {
  return asWorkPlan(value) != null;
}