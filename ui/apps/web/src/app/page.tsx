"use client";

import { Thread } from "@/components/thread";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { NodeTrackProvider } from "@/providers/node-track";
import { HudProvider } from "@/providers/Hud";
import { Toaster } from "@/components/ui/sonner";
import React from "react";

export default function DemoPage(): React.ReactNode {
  return (
    <React.Suspense
      fallback={
        <div className="hud-root h-screen flex items-center justify-center kicker">
          Loading the war room…
        </div>
      }
    >
      <Toaster theme="dark" />
      <ThreadProvider>
        <NodeTrackProvider>
          <StreamProvider>
            <HudProvider>
              <Thread />
            </HudProvider>
          </StreamProvider>
        </NodeTrackProvider>
      </ThreadProvider>
    </React.Suspense>
  );
}
