"use client";

import React, { createContext, useContext, useCallback, useState } from "react";
import { nodeLabel, type NodeLog } from "@/lib/run-progress";
import { STAGES } from "@/lib/roster";
import { isUtterance, type Utterance } from "@/lib/isms";

const STAGE_NODES = new Set(STAGES.flatMap((s) => s.nodes));

type NodeTrack = {
  currentNode: string | null;
  nodeLog: NodeLog[];
  utterances: Utterance[];
  latestUtterance: Utterance | null;
  noteUpdate: (data: Record<string, unknown>, namespace?: string[]) => void;
  noteUtterance: (data: unknown) => void;
  beginRun: () => void;
};

const NodeTrackContext = createContext<NodeTrack>({
  currentNode: null,
  nodeLog: [],
  utterances: [],
  latestUtterance: null,
  noteUpdate: () => {},
  noteUtterance: () => {},
  beginRun: () => {},
});

function firstStageNode(
  data: Record<string, unknown>,
  namespace?: string[],
): string | null {
  const nsLast = namespace?.at(-1)?.split(":").pop();
  if (nsLast && STAGE_NODES.has(nsLast)) return nsLast;
  const keys = Object.keys(data ?? {}).filter(
    (k) => k && k !== "ns" && !k.startsWith("__"),
  );
  return keys.find((k) => STAGE_NODES.has(k)) ?? keys[0] ?? null;
}

export function NodeTrackProvider({ children }: { children: React.ReactNode }) {
  const [currentNode, setCurrentNode] = useState<string | null>(null);
  const [nodeLog, setNodeLog] = useState<NodeLog[]>([]);
  const [utterances, setUtterances] = useState<Utterance[]>([]);

  const noteUpdate = useCallback(
    (data: Record<string, unknown>, namespace?: string[]) => {
      const node = firstStageNode(data, namespace);
      if (!node) return;
      setCurrentNode(node);
      setNodeLog((prev) =>
        [...prev, { at: Date.now(), node, label: nodeLabel(node) }].slice(-40),
      );
    },
    [],
  );

  const noteUtterance = useCallback((data: unknown) => {
    if (!isUtterance(data)) return;
    const next: Utterance = { ...data, at: Date.now() };
    setUtterances((prev) => [...prev, next].slice(-40));
  }, []);

  const beginRun = useCallback(() => {
    setUtterances([]);
    setNodeLog([]);
    setCurrentNode(null);
  }, []);

  const latestUtterance = utterances.at(-1) ?? null;

  return (
    <NodeTrackContext.Provider
      value={{
        currentNode,
        nodeLog,
        utterances,
        latestUtterance,
        noteUpdate,
        noteUtterance,
        beginRun,
      }}
    >
      {children}
    </NodeTrackContext.Provider>
  );
}

export function useNodeTrack() {
  return useContext(NodeTrackContext);
}
