import type {
  ActionStatus,
  InteractionItem,
  MessageRole,
  MessageStatus
} from "../../../contracts/presentation/interactions.js"
import { TraceSelection } from "../../../contracts/presentation/interactions.js"
import type {
  OpenAgentTraceCorpusLaneLabel,
  OpenAgentTracePanelGroupKey,
  OpenAgentTraceTranscriptModel
} from "../../../contracts/study/workflow/open-agent-trace.js"

import { Match } from "effect"

type InteractionTone = "neutral" | "info" | "positive" | "attention" | "danger"

const interactionRoleToneByRole: Record<MessageRole, InteractionTone> = {
  user: "info",
  assistant: "positive",
  system: "neutral",
  tool: "attention",
  runtime: "danger",
  custom: "neutral"
}

const interactionMessageStatusToneByStatus: Record<MessageStatus, InteractionTone> = {
  default: "neutral",
  active: "info",
  error: "danger"
}

const interactionActionStatusToneByStatus: Record<ActionStatus, InteractionTone> = {
  default: "neutral",
  active: "info",
  success: "positive",
  error: "danger"
}

const interactionCoverageToneBySeverity: Record<"info" | "warning" | "error", InteractionTone> = {
  info: "info",
  warning: "attention",
  error: "danger"
}

const traceGroupTitleByKey: Record<OpenAgentTracePanelGroupKey, string> = {
  source: "Source",
  trace: "Trace",
  workflow: "Workflow",
  usage: "Usage",
  coverage: "Coverage"
}

const traceGroupDescriptionByKey: Record<OpenAgentTracePanelGroupKey, string> = {
  source: "Corpus provenance, digests, and redaction posture for the active trace.",
  trace: "Normalized event history and branch structure for the active imported record.",
  workflow: "Projected workflow graph, evaluation cases, and executable handoff details.",
  usage: "Assistant usage provenance and execution metadata preserved alongside the trace.",
  coverage: "Explicit workflow coverage gaps emitted while projecting this imported trace."
}

const corpusLaneLabelByKey: Record<OpenAgentTraceCorpusLaneLabel, string> = {
  empty: "Empty lane",
  "fixture-backed": "Fixture-backed",
  "import-backed": "Import-backed",
  mixed: "Mixed lane"
}

const corpusLaneToneByKey: Record<OpenAgentTraceCorpusLaneLabel, InteractionTone> = {
  empty: "neutral",
  "fixture-backed": "info",
  "import-backed": "attention",
  mixed: "positive"
}

export const interactionItemId = (item: InteractionItem): string =>
  Match.value(item).pipe(
    Match.tag("InteractionMessageItem", ({ message }) => message.id),
    Match.tag("InteractionActionItem", ({ id }) => id),
    Match.exhaustive
  )

export const interactionItemsForTranscript = (
  transcript: OpenAgentTraceTranscriptModel
): ReadonlyArray<InteractionItem> => transcript.surface.turns.flatMap((turn) => turn.items)

export const interactionSelectionSummary = (item: InteractionItem): string =>
  Match.value(item).pipe(
    Match.tag("InteractionMessageItem", ({ message }) => `${message.actor.label} · ${message.actor.role} message`),
    Match.tag("InteractionActionItem", ({ action }) => `${action.label} · ${action.kind} action`),
    Match.exhaustive
  )

const interactionSelectionQuote = (item: InteractionItem): string | null =>
  Match.value(item).pipe(
    Match.tag("InteractionMessageItem", ({ message }) => {
      const [firstText] = message.content.flatMap((content) =>
        content._tag === "MessageTextContent" && content.kind === "body" ? [content.text] : []
      )

      return firstText ?? null
    }),
    Match.tag("InteractionActionItem", ({ action }) => action.supportingText ?? null),
    Match.exhaustive
  )

const interactionSelectionContextLabel = (item: InteractionItem): string | null =>
  Match.value(item).pipe(
    Match.tag("InteractionMessageItem", ({ message }) => message.actor.label),
    Match.tag("InteractionActionItem", ({ action, actor }) => `${actor.label} · ${action.label}`),
    Match.exhaustive
  )

const interactionSelectionKind = (item: InteractionItem): TraceSelection["itemKind"] =>
  Match.value(item).pipe(
    Match.withReturnType<TraceSelection["itemKind"]>(),
    Match.tag("InteractionMessageItem", () => "message"),
    Match.tag("InteractionActionItem", () => "action"),
    Match.exhaustive
  )

export const traceSelectionForTranscriptItem = ({
  item,
  transcriptEntryId,
  turnId
}: {
  readonly item: InteractionItem
  readonly transcriptEntryId: string
  readonly turnId: string
}): TraceSelection =>
  TraceSelection.make({
    anchor: {
      itemId: interactionItemId(item),
      transcriptEntryId,
      turnId
    },
    contextLabel: interactionSelectionContextLabel(item),
    itemKind: interactionSelectionKind(item),
    quote: interactionSelectionQuote(item),
    summary: interactionSelectionSummary(item)
  })

export const interactionRoleTone = (role: MessageRole): InteractionTone => interactionRoleToneByRole[role]

export const interactionMessageStatusTone = (status: MessageStatus): InteractionTone =>
  interactionMessageStatusToneByStatus[status]

export const interactionActionStatusTone = (status: ActionStatus): InteractionTone =>
  interactionActionStatusToneByStatus[status]

export const interactionCoverageTone = (
  severity: "info" | "warning" | "error"
): InteractionTone => interactionCoverageToneBySeverity[severity]

export const traceGroupTitle = (key: OpenAgentTracePanelGroupKey): string => traceGroupTitleByKey[key]

export const traceGroupDescription = (key: OpenAgentTracePanelGroupKey): string => traceGroupDescriptionByKey[key]

export const corpusLaneLabel = (label: OpenAgentTraceCorpusLaneLabel): string => corpusLaneLabelByKey[label]

export const corpusLaneTone = (label: OpenAgentTraceCorpusLaneLabel): InteractionTone => corpusLaneToneByKey[label]
