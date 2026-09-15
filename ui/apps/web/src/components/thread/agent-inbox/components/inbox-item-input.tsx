import { HumanResponseWithEdits, SubmitType } from "../types";
import { Textarea } from "@/components/ui/textarea";
import React from "react";
import { haveArgsChanged, prettifyText } from "../utils";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";
import { MarkdownText } from "../../markdown-text";
import { ActionRequest, HumanInterrupt } from "@langchain/langgraph/prebuilt";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { isRenderablePlan, PlanDocument } from "@/components/hud/plan-document";
import { prettyArg } from "@/lib/run-progress";

const CONSOLE_TEXTAREA =
  "h-auto min-h-24 max-h-[40vh] w-full max-w-full overflow-auto font-console text-[13px] leading-relaxed text-[#e8dcc4] bg-[#0c0d12] border-[#3a3224] rounded-none shadow-none whitespace-pre-wrap break-words field-sizing-content";

function ResetButton({ handleReset }: { handleReset: () => void }) {
  return (
    <Button
      onClick={handleReset}
      variant="ghost"
      className="flex items-center justify-center gap-2 text-[#8a7d64] hover:text-[var(--dire)]"
    >
      <Undo2 className="w-4 h-4" />
      <span>Reset</span>
    </Button>
  );
}

function ArgBody({ value }: { value: unknown }) {
  if (isRenderablePlan(value)) {
    return <PlanDocument value={value} />;
  }
  if (typeof value === "string") {
    return (
      <div className="text-[13px] leading-relaxed text-[#e8dcc4] break-words min-w-0 max-w-full">
        <MarkdownText>{value}</MarkdownText>
      </div>
    );
  }
  return (
    <pre className="font-console text-[12px] leading-relaxed text-[#cfc3a8] whitespace-pre-wrap break-words max-w-full">
      {prettyArg(value)}
    </pre>
  );
}

function ArgsRenderer({ args }: { args: Record<string, any> }) {
  return (
    <div className="flex flex-col gap-6 items-start w-full min-w-0">
      {Object.entries(args).map(([k, v]) => (
        <div
          key={`args-${k}`}
          className="flex flex-col gap-2 items-start w-full min-w-0"
        >
          <p className="kicker">{prettifyText(k)}</p>
          <div className="w-full min-w-0 max-w-full">
            <ArgBody value={v} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface InboxItemInputProps {
  interruptValue: HumanInterrupt;
  humanResponse: HumanResponseWithEdits[];
  supportsMultipleMethods: boolean;
  acceptAllowed: boolean;
  hasEdited: boolean;
  hasAddedResponse: boolean;
  initialValues: Record<string, string>;

  streaming: boolean;
  streamFinished: boolean;

  setHumanResponse: React.Dispatch<
    React.SetStateAction<HumanResponseWithEdits[]>
  >;
  setSelectedSubmitType: React.Dispatch<
    React.SetStateAction<SubmitType | undefined>
  >;
  setHasAddedResponse: React.Dispatch<React.SetStateAction<boolean>>;
  setHasEdited: React.Dispatch<React.SetStateAction<boolean>>;

  handleSubmit: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent,
  ) => Promise<void>;
}

function ResponseComponent({
  humanResponse,
  streaming,
  showArgsInResponse,
  interruptValue,
  onResponseChange,
  handleSubmit,
}: {
  humanResponse: HumanResponseWithEdits[];
  streaming: boolean;
  showArgsInResponse: boolean;
  interruptValue: HumanInterrupt;
  onResponseChange: (change: string, response: HumanResponseWithEdits) => void;
  handleSubmit: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent,
  ) => Promise<void>;
}) {
  const res = humanResponse.find((r) => r.type === "response");
  if (!res || typeof res.args !== "string") {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 items-start w-full border border-[#3a3224] min-w-0">
      <div className="flex items-center justify-between w-full">
        <p className="kicker">Respond</p>
        <ResetButton
          handleReset={() => {
            onResponseChange("", res);
          }}
        />
      </div>

      {showArgsInResponse && (
        <ArgsRenderer args={interruptValue.action_request.args} />
      )}

      <div className="flex flex-col gap-[6px] items-start w-full min-w-0">
        <p className="kicker">Your call</p>
        <Textarea
          disabled={streaming}
          value={res.args}
          onChange={(e) => onResponseChange(e.target.value, res)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="Instructions back to the roster…"
          className={CONSOLE_TEXTAREA}
        />
      </div>

      <div className="flex items-center justify-end w-full gap-2">
        <Button
          variant="brand"
          disabled={streaming}
          onClick={handleSubmit}
          className="hud-btn hud-btn-radiant bg-transparent"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
const Response = React.memo(ResponseComponent);

function AcceptComponent({
  streaming,
  actionRequestArgs,
  handleSubmit,
}: {
  streaming: boolean;
  actionRequestArgs: Record<string, any>;
  handleSubmit: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent,
  ) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4 items-start w-full p-4 border border-[#3a3224] min-w-0">
      {actionRequestArgs && Object.keys(actionRequestArgs).length > 0 && (
        <ArgsRenderer args={actionRequestArgs} />
      )}
      <Button
        variant="brand"
        disabled={streaming}
        onClick={handleSubmit}
        className="hud-btn hud-btn-radiant w-full bg-transparent"
      >
        Accept
      </Button>
    </div>
  );
}

function EditField({
  fieldKey,
  value,
  streaming,
  onEditChange,
  editResponse,
  handleKeyDown,
}: {
  fieldKey: string;
  value: unknown;
  streaming: boolean;
  onEditChange: (
    text: string | string[],
    response: HumanResponseWithEdits,
    key: string | string[],
  ) => void;
  editResponse: HumanResponseWithEdits;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const [showJson, setShowJson] = React.useState(false);
  const pretty = prettyArg(value);
  const [draft, setDraft] = React.useState(pretty);
  const plan = isRenderablePlan(value);
  const structured = plan || (typeof value === "object" && value !== null);

  React.useEffect(() => {
    if (!showJson) setDraft(pretty);
  }, [pretty, showJson]);

  return (
    <div className="flex flex-col gap-2 items-start w-full min-w-0">
      <div className="flex items-center justify-between w-full gap-2">
        <p className="kicker">{prettifyText(fieldKey)}</p>
        {structured && (
          <button
            type="button"
            className="kicker text-[#8a7d64] hover:text-[var(--gold-bright)]"
            onClick={() => setShowJson((s) => !s)}
          >
            {showJson ? "Read the draft" : "Edit JSON"}
          </button>
        )}
      </div>

      {plan && !showJson ? (
        <PlanDocument value={value} />
      ) : (
        <Textarea
          disabled={streaming}
          className={CONSOLE_TEXTAREA}
          value={structured ? draft : typeof value === "string" || typeof value === "number" ? String(value) : pretty}
          onChange={(e) => {
            setDraft(e.target.value);
            onEditChange(e.target.value, editResponse, fieldKey);
          }}
          onKeyDown={handleKeyDown}
          rows={structured ? Math.min(24, Math.max(8, draft.split("\n").length)) : 6}
        />
      )}
    </div>
  );
}

function EditAndOrAcceptComponent({
  humanResponse,
  streaming,
  initialValues,
  onEditChange,
  handleSubmit,
  interruptValue,
}: {
  humanResponse: HumanResponseWithEdits[];
  streaming: boolean;
  initialValues: Record<string, string>;
  interruptValue: HumanInterrupt;
  onEditChange: (
    text: string | string[],
    response: HumanResponseWithEdits,
    key: string | string[],
  ) => void;
  handleSubmit: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent,
  ) => Promise<void>;
}) {
  const editResponse = humanResponse.find((r) => r.type === "edit");
  const acceptResponse = humanResponse.find((r) => r.type === "accept");
  if (
    !editResponse ||
    typeof editResponse.args !== "object" ||
    !editResponse.args
  ) {
    if (acceptResponse) {
      return (
        <AcceptComponent
          actionRequestArgs={interruptValue.action_request.args}
          streaming={streaming}
          handleSubmit={handleSubmit}
        />
      );
    }
    return null;
  }
  const header = editResponse.acceptAllowed ? "The Draft" : "Revise";
  let buttonText = "Submit";
  if (editResponse.acceptAllowed && !editResponse.editsMade) {
    buttonText = "Accept";
  }

  const handleReset = () => {
    if (
      !editResponse ||
      typeof editResponse.args !== "object" ||
      !editResponse.args ||
      !editResponse.args.args
    ) {
      return;
    }
    const keysToReset: string[] = [];
    const valuesToReset: string[] = [];
    Object.entries(initialValues).forEach(([k, v]) => {
      if (k in (editResponse.args as Record<string, any>).args) {
        keysToReset.push(k);
        valuesToReset.push(typeof v === "string" ? v : prettyArg(v));
      }
    });

    if (keysToReset.length > 0 && valuesToReset.length > 0) {
      onEditChange(valuesToReset, editResponse, keysToReset);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col gap-4 items-start w-full p-4 border border-[#3a3224] min-w-0 max-w-full">
      <div className="flex items-center justify-between w-full">
        <p className="kicker">{header}</p>
        <ResetButton handleReset={handleReset} />
      </div>

      {Object.entries(editResponse.args.args).map(([k, v]) => (
        <EditField
          key={`allow-edit-args--${k}`}
          fieldKey={k}
          value={v}
          streaming={streaming}
          onEditChange={onEditChange}
          editResponse={editResponse}
          handleKeyDown={handleKeyDown}
        />
      ))}

      <div className="flex items-center justify-end w-full gap-2">
        <Button
          variant="brand"
          disabled={streaming}
          onClick={handleSubmit}
          className="hud-btn hud-btn-radiant bg-transparent"
        >
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
const EditAndOrAccept = React.memo(EditAndOrAcceptComponent);

function coerceEditedValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function InboxItemInput({
  interruptValue,
  humanResponse,
  streaming,
  streamFinished,
  supportsMultipleMethods,
  acceptAllowed,
  hasEdited,
  hasAddedResponse,
  initialValues,
  setHumanResponse,
  setSelectedSubmitType,
  setHasEdited,
  setHasAddedResponse,
  handleSubmit,
}: InboxItemInputProps) {
  const isEditAllowed = interruptValue.config.allow_edit;
  const isResponseAllowed = interruptValue.config.allow_respond;
  const hasArgs = Object.entries(interruptValue.action_request.args).length > 0;
  const showArgsInResponse =
    hasArgs && !isEditAllowed && !acceptAllowed && isResponseAllowed;
  const showArgsOutsideActionCards =
    hasArgs && !showArgsInResponse && !isEditAllowed && !acceptAllowed;

  const onEditChange = (
    change: string | string[],
    response: HumanResponseWithEdits,
    key: string | string[],
  ) => {
    if (
      (Array.isArray(change) && !Array.isArray(key)) ||
      (!Array.isArray(change) && Array.isArray(key))
    ) {
      toast.error("Error", {
        description: "Something went wrong",
        richColors: true,
        closeButton: true,
      });
      return;
    }

    const applied: unknown = Array.isArray(change)
      ? change.map((c) => coerceEditedValue(c))
      : coerceEditedValue(change);

    let valuesChanged = true;
    if (typeof response.args === "object") {
      const updatedArgs = { ...(response.args?.args || {}) };

      if (Array.isArray(applied) && Array.isArray(key)) {
        applied.forEach((value, index) => {
          if (index < key.length) {
            updatedArgs[key[index]] = value;
          }
        });
      } else {
        updatedArgs[key as string] = applied;
      }

      valuesChanged = haveArgsChanged(updatedArgs, initialValues);
    }

    if (!valuesChanged) {
      setHasEdited(false);
      if (acceptAllowed) {
        setSelectedSubmitType("accept");
      } else if (hasAddedResponse) {
        setSelectedSubmitType("response");
      }
    } else {
      setSelectedSubmitType("edit");
      setHasEdited(true);
    }

    setHumanResponse((prev) => {
      if (typeof response.args !== "object" || !response.args) {
        console.error(
          "Mismatched response type",
          !!response.args,
          typeof response.args,
        );
        return prev;
      }

      const nextArgs =
        Array.isArray(applied) && Array.isArray(key)
          ? {
              ...response.args.args,
              ...Object.fromEntries(key.map((k, i) => [k, applied[i]])),
            }
          : {
              ...response.args.args,
              [key as string]: applied,
            };

      const newEdit: HumanResponseWithEdits = {
        type: response.type,
        args: {
          action: response.args.action,
          args: nextArgs,
        },
      };
      if (
        prev.find(
          (p) =>
            p.type === response.type &&
            typeof p.args === "object" &&
            p.args?.action === (response.args as ActionRequest).action,
        )
      ) {
        return prev.map((p) => {
          if (
            p.type === response.type &&
            typeof p.args === "object" &&
            p.args?.action === (response.args as ActionRequest).action
          ) {
            if (p.acceptAllowed) {
              return {
                ...newEdit,
                acceptAllowed: true,
                editsMade: valuesChanged,
              };
            }

            return newEdit;
          }
          return p;
        });
      } else {
        throw new Error("No matching response found");
      }
    });
  };

  const onResponseChange = (
    change: string,
    response: HumanResponseWithEdits,
  ) => {
    if (!change) {
      setHasAddedResponse(false);
      if (hasEdited) {
        setSelectedSubmitType("edit");
      } else if (acceptAllowed) {
        setSelectedSubmitType("accept");
      }
    } else {
      setSelectedSubmitType("response");
      setHasAddedResponse(true);
    }

    setHumanResponse((prev) => {
      const newResponse: HumanResponseWithEdits = {
        type: response.type,
        args: change,
      };

      if (prev.find((p) => p.type === response.type)) {
        return prev.map((p) => {
          if (p.type === response.type) {
            if (p.acceptAllowed) {
              return {
                ...newResponse,
                acceptAllowed: true,
                editsMade: !!change,
              };
            }
            return newResponse;
          }
          return p;
        });
      } else {
        throw new Error("No human response found for string response");
      }
    });
  };

  return (
    <div className="w-full flex flex-col items-start justify-start gap-2 min-w-0">
      {showArgsOutsideActionCards && (
        <ArgsRenderer args={interruptValue.action_request.args} />
      )}

      <div className="flex flex-col gap-2 items-start w-full min-w-0">
        <EditAndOrAccept
          humanResponse={humanResponse}
          streaming={streaming}
          initialValues={initialValues}
          interruptValue={interruptValue}
          onEditChange={onEditChange}
          handleSubmit={handleSubmit}
        />
        {supportsMultipleMethods ? (
          <div className="flex gap-3 items-center mx-auto mt-3 w-full">
            <Separator className="flex-1" />
            <p className="kicker text-[#8a7d64]">Or</p>
            <Separator className="flex-1" />
          </div>
        ) : null}
        <Response
          humanResponse={humanResponse}
          streaming={streaming}
          showArgsInResponse={showArgsInResponse}
          interruptValue={interruptValue}
          onResponseChange={onResponseChange}
          handleSubmit={handleSubmit}
        />
        {streaming && (
          <p className="font-console text-[12px] text-[var(--gold)]">
            Channeling…
          </p>
        )}
        {streamFinished && (
          <p className="font-console text-[12px] text-[var(--radiant)]">
            The field is clear.
          </p>
        )}
      </div>
    </div>
  );
}
