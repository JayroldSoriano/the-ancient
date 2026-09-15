import { v4 as uuidv4 } from "uuid";
import { ReactNode, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useState, FormEvent } from "react";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { AssistantMessage } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
  ArrowDown,
  History,
  LoaderCircle,
  PanelRightOpen,
  PanelRightClose,
  RotateCcw,
  SquarePen,
} from "lucide-react";
import { useQueryState, parseAsBoolean, parseAsStringLiteral } from "nuqs";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { TopBar } from "@/components/hud/top-bar";
import { HeroStrip } from "@/components/hud/hero-strip";
import { ReplayPanel } from "@/components/hud/replay-panel";
import { ChannelBanner } from "@/components/hud/channel";
import { FieldBoard } from "@/components/hud/field-board";
import { ShopBoard } from "@/components/hud/shop-board";
import { patchShop } from "@/lib/shop";
import { useHud } from "@/providers/Hud";
import { useNodeTrack } from "@/providers/node-track";
import { STREAM_SUBMIT } from "@/lib/stream-opts";
import { fetchField, mergeFieldCache, readFieldCache, type Leftover } from "@/lib/field";
import {
  peekCleared,
  popCleared,
  pushCleared,
  readCleared,
  sessionTitle,
  type ClearedSession,
} from "@/lib/sessions";

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div ref={context.contentRef} className={props.contentClassName}>
        {props.content}
      </div>
      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <button
      className={cn("hud-btn px-3 py-1.5 flex items-center gap-2", props.className)}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="w-4 h-4" />
      <span>Drop camera</span>
    </button>
  );
}

export function Thread() {
  const [threadId, setThreadId] = useQueryState("threadId");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(["console", "field", "shop"]).withDefault("console"),
  );
  const [apiUrl] = useQueryState("apiUrl");
  const [input, setInput] = useState("");
  const [cleared, setCleared] = useState<ClearedSession[]>([]);
  const [pendingDecree, setPendingDecree] = useState<string | null>(null);
  const [leftovers, setLeftovers] = useState<Leftover[]>([]);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const { action } = useHud();
  const { beginRun } = useNodeTrack();

  const stream = useStreamContext();
  const messages = stream.messages;
  const isLoading = stream.isLoading;
  const lastError = useRef<string | undefined>(undefined);

  useEffect(() => {
    setCleared(readCleared());
  }, []);

  useEffect(() => {
    const cached = readFieldCache();
    if (cached) {
      setLeftovers(
        cached.counsel?.reminders?.length
          ? cached.counsel.reminders
          : cached.leftovers,
      );
      return;
    }
    const graph =
      apiUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:2024";
    fetchField(graph)
      .then((snap) => {
        setLeftovers(mergeFieldCache(snap).leftovers);
      })
      .catch(() => {});
  }, [apiUrl]);

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as { message?: string }).message;
      if (!message || lastError.current === message) return;
      lastError.current = message;
      const outOfMana = /session limit|out of mana/i.test(message);
      toast.error(outOfMana ? "Out of mana." : "The Ancient shuddered.", {
        description: (
          <p className="font-console text-xs">
            {outOfMana
              ? "Side shop (Claude Pro) is dry. Open The Secret Shop to spend Cursor, or wait for the fountain."
              : null}
            <code className="block mt-1">{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      /* ignore */
    }
  }, [stream.error]);

  const stashCurrent = useCallback(() => {
    if (!threadId) return;
    const next = pushCleared({
      threadId,
      title: sessionTitle(messages),
      at: Date.now(),
    });
    setCleared(next);
  }, [threadId, messages]);

  const clearSession = useCallback(() => {
    stashCurrent();
    setInput("");
    beginRun();
    setThreadId(null);
    toast("Match cleared.", {
      description: peekCleared()
        ? "Type /resume or hit Resume to return."
        : undefined,
      duration: 2500,
    });
  }, [stashCurrent, beginRun, setThreadId]);

  const resumeSession = useCallback(
    (id?: string) => {
      let target = id;
      if (!target) {
        target = popCleared()?.threadId;
        setCleared(readCleared());
      } else if (id && id.length < 36) {
        const hit = readCleared().find((s) => s.threadId.startsWith(id));
        if (hit) target = hit.threadId;
      }
      if (!target) {
        setChatHistoryOpen(true);
        toast("No cleared match.", {
          description: "Open Replays to pick an older thread.",
        });
        return;
      }
      if (threadId && threadId !== target) stashCurrent();
      beginRun();
      setThreadId(target);
      setTab("console");
    },
    [threadId, stashCurrent, beginRun, setThreadId, setTab, setChatHistoryOpen],
  );

  const submitDecree = useCallback(
    (text: string, fresh = false) => {
      if (!text.trim() || isLoading) return;
      const newHumanMessage: Message = {
        id: uuidv4(),
        type: "human",
        content: text,
      };
      beginRun();
      const toolMessages = fresh
        ? []
        : ensureToolCallsHaveResponses(stream.messages);
      stream.submit(
        { messages: [...toolMessages, newHumanMessage] },
        {
          ...STREAM_SUBMIT,
          optimisticValues: (prev) => ({
            ...(fresh ? {} : prev),
            messages: [
              ...(fresh ? [] : (prev.messages ?? [])),
              ...toolMessages,
              newHumanMessage,
            ],
          }),
        },
      );
      setInput("");
    },
    [isLoading, beginRun, stream],
  );

  useEffect(() => {
    if (!pendingDecree) return;
    if (threadId) {
      stashCurrent();
      setThreadId(null);
      return;
    }
    const text = pendingDecree;
    setPendingDecree(null);
    setTab("console");
    submitDecree(text, true);
  }, [pendingDecree, threadId, stashCurrent, setThreadId, setTab, submitDecree]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    if (trimmed === "/clear") {
      clearSession();
      return;
    }
    if (trimmed === "/field") {
      setInput("");
      setTab("field");
      return;
    }
    if (trimmed === "/shop" || trimmed === "/shop show") {
      setInput("");
      setTab("shop");
      return;
    }
    if (trimmed === "/shop claude" || trimmed === "/shop cursor") {
      const provider = trimmed === "/shop claude" ? "claude" : "cursor";
      const graph = apiUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:2024";
      setInput("");
      void patchShop(graph, { provider })
        .then((shop) => {
          toast(
            provider === "cursor"
              ? "Buying from the Secret Shop."
              : "Buying from the side shop.",
            {
              description:
                shop.provider === "cursor"
                  ? "Pipeline gold is Cursor now."
                  : "Pipeline gold is Claude Pro now.",
            },
          );
        })
        .catch((err: unknown) => {
          setTab("shop");
          toast.error("The merchant refused.", {
            description: err instanceof Error ? err.message : String(err),
          });
        });
      return;
    }
    if (trimmed === "/console") {
      setInput("");
      setTab("console");
      return;
    }
    if (trimmed.startsWith("/resume")) {
      const arg = trimmed.slice("/resume".length).trim();
      setInput("");
      resumeSession(arg || undefined);
      return;
    }

    submitDecree(trimmed);
  };

  const handleRegenerate = (
    parentCheckpoint: Checkpoint | null | undefined,
  ) => {
    beginRun();
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      ...STREAM_SUBMIT,
    });
  };

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );

  return (
    <div className="hud-root flex h-screen w-full overflow-hidden">
      <div className="relative lg:flex hidden z-20">
        <motion.div
          className="absolute h-full overflow-hidden z-20"
          style={{ width: 280 }}
          animate={{ x: chatHistoryOpen ? 0 : -280 }}
          initial={{ x: -280 }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          <div className="relative h-full" style={{ width: 280 }}>
            <ThreadHistory />
          </div>
        </motion.div>
      </div>

      <motion.div
        className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10"
        layout={isLargeScreen}
        animate={{
          marginLeft: chatHistoryOpen ? (isLargeScreen ? 280 : 0) : 0,
        }}
        transition={
          isLargeScreen
            ? { type: "spring", stiffness: 300, damping: 30 }
            : { duration: 0 }
        }
      >
        <TopBar />
        <HeroStrip />

        <div className="flex items-center gap-2 px-3 py-1 border-b border-[#3a3224] bg-[#0c0d12]/80">
          {(!chatHistoryOpen || !isLargeScreen) && (
            <button
              className="hud-btn px-2 py-1"
              onClick={() => setChatHistoryOpen((p) => !p)}
            >
              {chatHistoryOpen ? (
                <PanelRightOpen className="size-4" />
              ) : (
                <PanelRightClose className="size-4" />
              )}
            </button>
          )}
          <button
            type="button"
            className="hud-tab"
            data-active={tab === "console"}
            onClick={() => setTab("console")}
          >
            Live console
          </button>
          <button
            type="button"
            className="hud-tab"
            data-active={tab === "field"}
            onClick={() => setTab("field")}
          >
            The Field
          </button>
          <button
            type="button"
            className="hud-tab"
            data-active={tab === "shop"}
            onClick={() => setTab("shop")}
          >
            The Secret Shop
          </button>
          <div className="ml-auto flex items-center gap-2">
            {tab === "console" && (
              <label className="flex items-center gap-2 kicker cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideToolCalls ?? false}
                  onChange={(e) => setHideToolCalls(e.target.checked)}
                  className="accent-[#c9aa71]"
                />
                Hide cogs
              </label>
            )}
            <TooltipIconButton
              size="lg"
              className="text-[var(--gold)] hover:bg-[#242018]"
              tooltip="/clear — new match"
              variant="ghost"
              onClick={clearSession}
            >
              <SquarePen className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              size="lg"
              className="text-[var(--gold)] hover:bg-[#242018]"
              tooltip={
                cleared[0]
                  ? `/resume — ${cleared[0].title}`
                  : "/resume — last cleared match"
              }
              variant="ghost"
              disabled={!cleared.length}
              onClick={() => resumeSession()}
            >
              <RotateCcw className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              size="lg"
              className="text-[var(--gold)] hover:bg-[#242018] lg:hidden"
              tooltip="Replays"
              variant="ghost"
              onClick={() => setChatHistoryOpen((p) => !p)}
            >
              <History className="size-4" />
            </TooltipIconButton>
          </div>
        </div>

        {tab === "field" ? (
          <div className="flex flex-1 min-h-0 w-full">
            <FieldBoard
              onDecree={(text) => setPendingDecree(text)}
              onResumeThread={(id) => resumeSession(id)}
            />
          </div>
        ) : tab === "shop" ? (
          <div className="flex flex-1 min-h-0 w-full">
            <ShopBoard />
          </div>
        ) : (
        <div className="flex flex-1 min-h-0">
          <StickToBottom className="relative flex-1 overflow-hidden">
            <StickyToBottomContent
              className={cn(
                "absolute px-4 inset-0 overflow-y-scroll overflow-x-hidden",
                !chatStarted && "flex flex-col items-stretch",
                chatStarted && "grid grid-rows-[1fr_auto]",
              )}
              contentClassName={cn(
                "pt-6 pb-16 max-w-3xl mx-auto flex flex-col gap-3 w-full min-w-0",
                !chatStarted && "mt-[8vh]",
              )}
              content={
                <>
                  {!chatStarted && (
                    <div className="text-center mb-6">
                      <p className="kicker">Jayrold · The Ancient</p>
                      <h1 className="font-display text-4xl tracking-[0.2em] text-[var(--gold-bright)] mt-2">
                        CONSOLE
                      </h1>
                      <p className="mt-3 text-sm text-[#8a7d64] max-w-md mx-auto">
                        Speak a request. Invoker decomposes it. Nothing is forged
                        until you accept The Draft. Io relocates only after The Push.
                      </p>
                      <p className="mt-3 font-console text-[12px] text-[#5a4e3a]">
                        /clear starts a new match · /resume returns to the last one ·
                        The Field lists every open GitHub issue · /shop switches fountains
                      </p>
                      {leftovers.length > 0 && (
                        <p className="mt-3 font-console text-[12px] text-[#8a7d64]">
                          Unpaid on The Field: {leftovers[0].title}
                          {leftovers.length > 1
                            ? ` · +${leftovers.length - 1}`
                            : ""}
                        </p>
                      )}
                    </div>
                  )}
                  {messages
                    .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                    .map((message, index) =>
                      message.type === "human" ? (
                        <HumanMessage
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                          isLoading={isLoading}
                        />
                      ) : (
                        <AssistantMessage
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                          isLoading={isLoading}
                          handleRegenerate={handleRegenerate}
                        />
                      ),
                    )}
                  {hasNoAIOrToolMessages && !!stream.interrupt && (
                    <AssistantMessage
                      key="interrupt-msg"
                      message={undefined}
                      isLoading={isLoading}
                      handleRegenerate={handleRegenerate}
                    />
                  )}
                  {isLoading && <ChannelBanner />}
                </>
              }
              footer={
                <div className="sticky flex flex-col items-center gap-2 bottom-0 bg-gradient-to-t from-[#07080b] via-[#07080b] to-transparent pt-6">
                  <ScrollToBottom className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3" />
                  <div className="hud-panel mx-auto mb-4 w-full max-w-3xl relative z-10">
                    <form
                      onSubmit={handleSubmit}
                      className="grid grid-rows-[1fr_auto]"
                    >
                      <div className="flex items-start gap-2 px-3 pt-3">
                        <span className="font-console text-[var(--gold)] pt-2">
                          {">"}
                        </span>
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              !e.shiftKey &&
                              !e.metaKey &&
                              !e.nativeEvent.isComposing
                            ) {
                              e.preventDefault();
                              const el = e.target as HTMLElement | undefined;
                              const form = el?.closest("form");
                              form?.requestSubmit();
                            }
                          }}
                          placeholder={
                            action === "approve_plan"
                              ? "The Draft awaits your call…"
                              : action === "approve_work"
                                ? "The Push — relocate, send back, or abandon…"
                                : "Issue a decree, or /clear  /resume  /shop"
                          }
                          className="flex-1 p-2 border-none bg-transparent font-console text-[13px] text-[#e8dcc4] placeholder:text-[#5a4e3a] field-sizing-content shadow-none ring-0 outline-none resize-none min-h-[52px]"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 p-2">
                        {stream.isLoading ? (
                          <button
                            type="button"
                            key="stop"
                            className="hud-btn hud-btn-dire px-4 py-2 flex items-center gap-2"
                            onClick={() => stream.stop()}
                          >
                            <LoaderCircle className="w-4 h-4 animate-spin" />
                            Surrender
                          </button>
                        ) : (
                          <button
                            type="submit"
                            className="hud-btn hud-btn-radiant px-5 py-2"
                            disabled={isLoading || !input.trim()}
                          >
                            Issue
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              }
            />
          </StickToBottom>
          <ReplayPanel />
        </div>
        )}
      </motion.div>
    </div>
  );
}
