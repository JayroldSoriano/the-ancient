import type { StreamMode } from "@langchain/langgraph-sdk";

export const STREAM_SUBMIT = {
  streamMode: ["values", "updates", "custom"] as StreamMode[],
  streamSubgraphs: true,
};
