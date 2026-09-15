import { Button } from "@/components/ui/button";
import { ThreadIdCopyable } from "./thread-id";
import { InboxItemInput } from "./inbox-item-input";
import useInterruptedActions from "../hooks/use-interrupted-actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { constructOpenInStudioURL } from "../utils";
import { HumanInterrupt } from "@langchain/langgraph/prebuilt";

interface ThreadActionsViewProps {
  interrupt: HumanInterrupt;
  handleShowSidePanel: (showState: boolean, showDescription: boolean) => void;
  showState: boolean;
  showDescription: boolean;
}

function ButtonGroup({
  handleShowState,
  handleShowDescription,
  showingState,
  showingDescription,
}: {
  handleShowState: () => void;
  handleShowDescription: () => void;
  showingState: boolean;
  showingDescription: boolean;
}) {
  return (
    <div className="flex flex-row gap-0 items-center justify-center">
      <Button
        variant="outline"
        className={cn(
          "rounded-none border-[#3a3224]",
          showingState ? "bg-[var(--gold)] text-[#1a140c]" : "bg-[#0c0d12] text-[var(--gold)]",
        )}
        size="sm"
        onClick={handleShowState}
      >
        State
      </Button>
      <Button
        variant="outline"
        className={cn(
          "rounded-none border-[#3a3224]",
          showingDescription
            ? "bg-[var(--gold)] text-[#1a140c]"
            : "bg-[#0c0d12] text-[var(--gold)]",
        )}
        size="sm"
        onClick={handleShowDescription}
      >
        Description
      </Button>
    </div>
  );
}

export function ThreadActionsView({
  interrupt,
  handleShowSidePanel,
  showDescription,
  showState,
}: ThreadActionsViewProps) {
  const [threadId] = useQueryState("threadId");
  const {
    acceptAllowed,
    hasEdited,
    hasAddedResponse,
    streaming,
    supportsMultipleMethods,
    streamFinished,
    loading,
    handleSubmit,
    handleIgnore,
    handleResolve,
    setSelectedSubmitType,
    setHasAddedResponse,
    setHasEdited,
    humanResponse,
    setHumanResponse,
    initialHumanInterruptEditValue,
  } = useInterruptedActions({
    interrupt,
  });
  const [apiUrl] = useQueryState("apiUrl");

  const handleOpenInStudio = () => {
    if (!apiUrl) {
      toast.error("Error", {
        description: "Please set the LangGraph deployment URL in settings.",
        duration: 5000,
        richColors: true,
        closeButton: true,
      });
      return;
    }

    const studioUrl = constructOpenInStudioURL(apiUrl, threadId ?? undefined);
    window.open(studioUrl, "_blank");
  };

  const threadTitle =
    interrupt.action_request.action === "approve_plan"
      ? "The Draft"
      : interrupt.action_request.action === "approve_work"
        ? "The Push"
        : interrupt.action_request.action || "Unknown";
  const actionsDisabled = loading || streaming;
  const ignoreAllowed = interrupt.config.allow_ignore;

  return (
    <div className="flex flex-col min-h-full w-full gap-6">
      <div className="flex flex-wrap items-center justify-between w-full gap-3">
        <div className="flex items-center justify-start gap-3">
          <div>
            <p className="kicker">The Ancient must speak</p>
            <p className="font-display text-3xl tracking-[0.16em] text-[var(--gold-bright)]">
              {threadTitle}
            </p>
          </div>
          {threadId && <ThreadIdCopyable threadId={threadId} />}
        </div>
        <div className="flex flex-row gap-2 items-center justify-start">
          {apiUrl && (
            <Button
              size="sm"
              variant="outline"
              className="hud-btn bg-transparent"
              onClick={handleOpenInStudio}
            >
              Studio
            </Button>
          )}
          <ButtonGroup
            handleShowState={() => handleShowSidePanel(true, false)}
            handleShowDescription={() => handleShowSidePanel(false, true)}
            showingState={showState}
            showingDescription={showDescription}
          />
        </div>
      </div>

      {interrupt.description && (
        <p className="text-sm text-[#cfc3a8] leading-relaxed">
          {interrupt.description}
        </p>
      )}

      <div className="flex flex-row gap-2 items-center justify-start w-full">
        <Button
          variant="outline"
          className="hud-btn"
          onClick={handleResolve}
          disabled={actionsDisabled}
        >
          Mark resolved
        </Button>
        {ignoreAllowed && (
          <Button
            variant="outline"
            className="hud-btn hud-btn-dire"
            onClick={handleIgnore}
            disabled={actionsDisabled}
          >
            Abandon
          </Button>
        )}
      </div>

      {/* Actions */}
      <InboxItemInput
        acceptAllowed={acceptAllowed}
        hasEdited={hasEdited}
        hasAddedResponse={hasAddedResponse}
        interruptValue={interrupt}
        humanResponse={humanResponse}
        initialValues={initialHumanInterruptEditValue.current}
        setHumanResponse={setHumanResponse}
        streaming={streaming}
        streamFinished={streamFinished}
        supportsMultipleMethods={supportsMultipleMethods}
        setSelectedSubmitType={setSelectedSubmitType}
        setHasAddedResponse={setHasAddedResponse}
        setHasEdited={setHasEdited}
        handleSubmit={handleSubmit}
      />
    </div>
  );
}
