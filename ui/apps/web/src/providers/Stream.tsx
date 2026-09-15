import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { getApiKey } from "@/lib/api-key";
import { useThreads } from "./Thread";
import { toast } from "sonner";
import { useNodeTrack } from "@/providers/node-track";
import { HeroEmblem } from "@/components/hud/emblem";
import type { WorkPlan, TaskResult } from "@/lib/run-progress";
import { isUtterance } from "@/lib/isms";

export type StateType = {
  messages: Message[];
  ui?: UIMessage[];
  request?: string;
  plan?: WorkPlan | null;
  results?: TaskResult[];
  report?: string;
  decision?: string | null;
  feedback?: string;
  prUrl?: string;
};

const useTypedStream = useStream<
  StateType,
  {
    UpdateType: {
      messages?: Message[] | Message | string;
      ui?: (UIMessage | RemoveUIMessage)[] | UIMessage | RemoveUIMessage;
    };
    CustomEventType: UIMessage | RemoveUIMessage;
  }
>;

type StreamContextType = ReturnType<typeof useTypedStream>;
const StreamContext = createContext<StreamContextType | undefined>(undefined);

async function sleep(ms = 4000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(
  apiUrl: string,
  apiKey: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/info`, {
      ...(apiKey && {
        headers: {
          "X-Api-Key": apiKey,
        },
      }),
    });

    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

const StreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
}: {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
}) => {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { getThreads, setThreads } = useThreads();
  const { noteUpdate, noteUtterance } = useNodeTrack();
  const streamValue = useTypedStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId: threadId ?? null,
    onUpdateEvent: (data, opts) => {
      if (data && typeof data === "object") {
        const ns =
          opts && typeof opts === "object" && "namespace" in opts
            ? (opts as { namespace?: string[] }).namespace
            : undefined;
        noteUpdate(data as Record<string, unknown>, ns);
      }
    },
    onCustomEvent: (event, options) => {
      if (isUtterance(event)) {
        noteUtterance(event);
        return;
      }
      options.mutate((prev) => {
        const ui = uiMessageReducer(prev.ui ?? [], event);
        return { ...prev, ui };
      });
    },
    onThreadId: (id) => {
      setThreadId(id);
      sleep().then(() => getThreads().then(setThreads).catch(console.error));
    },
  });

  useEffect(() => {
    checkGraphStatus(apiUrl, apiKey).then((ok) => {
      if (!ok) {
        toast.error("Failed to connect to LangGraph server", {
          description: () => (
            <p>
              Please ensure your graph is running at <code>{apiUrl}</code> and
              your API key is correctly set (if connecting to a deployed graph).
            </p>
          ),
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [apiKey, apiUrl]);

  return (
    <StreamContext.Provider value={streamValue}>
      {children}
    </StreamContext.Provider>
  );
};

// Default values for the form
const DEFAULT_API_URL = "http://localhost:2024";
const DEFAULT_ASSISTANT_ID = "agent";

export const StreamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Get environment variables
  const envApiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL;
  const envAssistantId: string | undefined =
    process.env.NEXT_PUBLIC_ASSISTANT_ID;
  const envApiKey: string | undefined =
    process.env.NEXT_PUBLIC_LANGSMITH_API_KEY;

  // Use URL params with env var fallbacks
  const [apiUrl, setApiUrl] = useQueryState("apiUrl", {
    defaultValue: envApiUrl || "",
  });
  const [assistantId, setAssistantId] = useQueryState("assistantId", {
    defaultValue: envAssistantId || "",
  });

  // For API key, use localStorage with env var fallback
  const [apiKey, _setApiKey] = useState(() => {
    const storedKey = getApiKey();
    return storedKey || envApiKey || "";
  });

  const setApiKey = (key: string) => {
    window.localStorage.setItem("lg:chat:apiKey", key);
    _setApiKey(key);
  };

  // Determine final values to use, prioritizing URL params then env vars
  const finalApiUrl = apiUrl || envApiUrl;
  const finalAssistantId = assistantId || envAssistantId;

  // If we're missing any required values, show the form
  if (!finalApiUrl || !finalAssistantId) {
    return (
      <div className="hud-root flex items-center justify-center min-h-screen w-full p-6">
        <div className="hud-panel max-w-xl w-full p-8 relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <HeroEmblem kind="ancient" className="w-10 h-10" />
            <div>
              <p className="kicker">Enter the game</p>
              <h1 className="font-display text-2xl tracking-[0.18em] text-[var(--gold-bright)]">
                THE ANCIENT
              </h1>
            </div>
          </div>
          <p className="text-sm text-[#8a7d64] mb-6">
            Point the console at a living graph. Local servers need no LangSmith key.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              setApiUrl(formData.get("apiUrl") as string);
              setApiKey(formData.get("apiKey") as string);
              setAssistantId(formData.get("assistantId") as string);
              form.reset();
            }}
            className="flex flex-col gap-5"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="apiUrl" className="kicker">
                Deployment URL
              </Label>
              <Input
                id="apiUrl"
                name="apiUrl"
                className="bg-[#0c0d12] border-[#3a3224] font-console"
                defaultValue={apiUrl || DEFAULT_API_URL}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="assistantId" className="kicker">
                Graph ID
              </Label>
              <Input
                id="assistantId"
                name="assistantId"
                className="bg-[#0c0d12] border-[#3a3224] font-console"
                defaultValue={assistantId || DEFAULT_ASSISTANT_ID}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="apiKey" className="kicker">
                LangSmith key — optional
              </Label>
              <PasswordInput
                id="apiKey"
                name="apiKey"
                defaultValue={apiKey ?? ""}
                className="bg-[#0c0d12] border-[#3a3224] font-console"
                placeholder="lsv2_pt_..."
              />
            </div>
            <button type="submit" className="hud-btn hud-btn-radiant px-4 py-3">
              Descend
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <StreamSession apiKey={apiKey} apiUrl={apiUrl} assistantId={assistantId}>
      {children}
    </StreamSession>
  );
};

// Create a custom hook to use the context
export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
};

export default StreamContext;
