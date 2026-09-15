"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStreamContext } from "@/providers/Stream";
import { useNodeTrack } from "@/providers/node-track";
import {
  deriveStages,
  interruptAction,
  scoreFrom,
  type GraphValues,
  type NodeLog,
} from "@/lib/run-progress";
import type { StageKey, StageStatus } from "@/lib/roster";
import type { Utterance } from "@/lib/isms";

type HudState = {
  currentNode: string | null;
  nodeLog: NodeLog[];
  stages: Record<StageKey, StageStatus>;
  score: ReturnType<typeof scoreFrom>;
  elapsed: string;
  action: string | null;
  values: GraphValues;
  latestUtterance: Utterance | null;
};

const HudContext = createContext<HudState | undefined>(undefined);

const IDLE_STAGES: Record<StageKey, StageStatus> = {
  plan: "idle",
  gate_draft: "idle",
  implement: "idle",
  review: "idle",
  evidence: "idle",
  report: "idle",
  gate_push: "idle",
  pr: "idle",
};

export function HudProvider({ children }: { children: React.ReactNode }) {
  const stream = useStreamContext();
  const { currentNode, nodeLog, latestUtterance } = useNodeTrack();
  const values = (stream.values ?? {}) as GraphValues;
  const action = interruptAction(stream.interrupt);
  const [tick, setTick] = useState(0);
  const started = useRef<number | null>(null);

  useEffect(() => {
    if (stream.isLoading && started.current == null) {
      started.current = Date.now();
    }
  }, [stream.isLoading]);

  useEffect(() => {
    if (!stream.isLoading) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [stream.isLoading]);

  const elapsed = useMemo(() => {
    if (!started.current) return "00:00";
    const s = Math.floor((Date.now() - started.current) / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, [tick, stream.isLoading]);

  const stages = useMemo(
    () =>
      deriveStages({
        values,
        isLoading: stream.isLoading,
        currentNode,
        interruptAction: action,
      }),
    [values, stream.isLoading, currentNode, action],
  );

  const score = useMemo(() => scoreFrom(values), [values]);

  return (
    <HudContext.Provider
      value={{ currentNode, nodeLog, stages, score, elapsed, action, values, latestUtterance }}
    >
      {children}
    </HudContext.Provider>
  );
}

export function useHud(): HudState {
  const ctx = useContext(HudContext);
  if (!ctx) {
    return {
      currentNode: null,
      nodeLog: [],
      stages: IDLE_STAGES,
      score: {
        passed: 0,
        blocked: 0,
        tasks: 0,
        checksOk: 0,
        checksFail: 0,
        gold: 0,
      },
      elapsed: "00:00",
      action: null,
      values: {},
      latestUtterance: null,
    };
  }
  return ctx;
}
