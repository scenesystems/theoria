import { Schema } from "effect"

import { EntryError } from "../../../contracts/entry-error.js"
import { EntryDraft } from "../../../contracts/entry/registry.js"
import { Metadata } from "../../../contracts/envelope.js"
import { Program } from "../../../contracts/presentation/program.js"
import { EntryRunIdentity } from "../../../contracts/study/run-plan.js"
import { RunData } from "../../../contracts/study/run.js"
import { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import { ChoreographyCue, type ChoreographyState } from "../../../contracts/study/workflow/choreography.js"

import { LocalProjectionScript, LocalRunFrame } from "./local.js"
import type { RunOwnership } from "./types.js"
import { RunOwnershipSchema } from "./types.js"

export type RunStartedMessage = {
  readonly _tag: "RunStarted"
  readonly token: number
  readonly sequence: number
  readonly ownership: RunOwnership
  readonly startedAtMs: number
  readonly draft: typeof EntryDraft.Type
  readonly identity: typeof EntryRunIdentity.Type
  readonly localProjectionScript: typeof LocalProjectionScript.Type | null
  readonly program: typeof Program.Type
}

export const RunStartedMessage = Schema.Struct({
  _tag: Schema.Literal("RunStarted"),
  token: Schema.Number,
  sequence: Schema.Number,
  ownership: RunOwnershipSchema,
  startedAtMs: Schema.Number,
  draft: EntryDraft,
  identity: EntryRunIdentity,
  localProjectionScript: Schema.NullOr(LocalProjectionScript),
  program: Program
})

export type RunFrameUpdatedMessage = {
  readonly _tag: "RunFrameUpdated"
  readonly sequence: number
  readonly frame: typeof LocalRunFrame.Type
}

export const RunFrameUpdatedMessage = Schema.Struct({
  _tag: Schema.Literal("RunFrameUpdated"),
  sequence: Schema.Number,
  frame: LocalRunFrame
})

export type RunCanonicalFrameObservedMessage = {
  readonly _tag: "RunCanonicalFrameObserved"
  readonly sequence: number
  readonly frame: typeof CanonicalFrame.Type
}

export const RunCanonicalFrameObservedMessage = Schema.Struct({
  _tag: Schema.Literal("RunCanonicalFrameObserved"),
  sequence: Schema.Number,
  frame: CanonicalFrame
})

export type RunChoreographyObservedMessage = {
  readonly _tag: "RunChoreographyObserved"
  readonly sequence: number
  readonly cue: typeof ChoreographyCue.Type
  readonly state: ChoreographyState
}

export const RunChoreographyObservedMessage = Schema.Struct({
  _tag: Schema.Literal("RunChoreographyObserved"),
  sequence: Schema.Number,
  cue: ChoreographyCue,
  state: Schema.Any
})

export type RunStreamCompleteObservedMessage = {
  readonly _tag: "RunStreamCompleteObserved"
  readonly sequence: number
  readonly observedAtMs: number
  readonly summary: string
  readonly meta: typeof Metadata.Type | null
}

export const RunStreamCompleteObservedMessage = Schema.Struct({
  _tag: Schema.Literal("RunStreamCompleteObserved"),
  sequence: Schema.Number,
  observedAtMs: Schema.Number,
  summary: Schema.String,
  meta: Schema.NullOr(Metadata)
})

type TimedRunMessageTag =
  | "RunStepQueueDrained"
  | "RunPauseCheckpointReached"
  | "RunPaused"
  | "RunResumed"
  | "RunStopping"
  | "RunStopped"

const timedRunMessage = <Tag extends TimedRunMessageTag, Key extends "observedAtMs" | "requestedAtMs" | "stoppedAtMs">(
  tag: Tag,
  key: Key
) =>
  Schema.Struct({
    _tag: Schema.Literal(tag),
    sequence: Schema.Number,
    [key]: Schema.Number
  })

export type RunStepQueueDrainedMessage = {
  readonly _tag: "RunStepQueueDrained"
  readonly sequence: number
  readonly observedAtMs: number
}

export const RunStepQueueDrainedMessage = timedRunMessage("RunStepQueueDrained", "observedAtMs")

export type RunPauseCheckpointReachedMessage = {
  readonly _tag: "RunPauseCheckpointReached"
  readonly sequence: number
  readonly observedAtMs: number
}

export const RunPauseCheckpointReachedMessage = timedRunMessage("RunPauseCheckpointReached", "observedAtMs")

export type RunPausedMessage = {
  readonly _tag: "RunPaused"
  readonly sequence: number
  readonly requestedAtMs: number
}

export const RunPausedMessage = timedRunMessage("RunPaused", "requestedAtMs")

export type RunResumedMessage = {
  readonly _tag: "RunResumed"
  readonly sequence: number
  readonly requestedAtMs: number
}

export const RunResumedMessage = timedRunMessage("RunResumed", "requestedAtMs")

export type RunStoppingMessage = {
  readonly _tag: "RunStopping"
  readonly sequence: number
  readonly requestedAtMs: number
}

export const RunStoppingMessage = timedRunMessage("RunStopping", "requestedAtMs")

export type RunStoppedMessage = {
  readonly _tag: "RunStopped"
  readonly sequence: number
  readonly stoppedAtMs: number
}

export const RunStoppedMessage = timedRunMessage("RunStopped", "stoppedAtMs")

export type RunFailedMessage = {
  readonly _tag: "RunFailed"
  readonly sequence: number
  readonly finalizedAtMs: number
  readonly error: typeof EntryError.Type
}

export const RunFailedMessage = Schema.Struct({
  _tag: Schema.Literal("RunFailed"),
  sequence: Schema.Number,
  finalizedAtMs: Schema.Number,
  error: EntryError
})

export type RunSucceededMessage = {
  readonly _tag: "RunSucceeded"
  readonly sequence: number
  readonly finalizedAtMs: number
  readonly data: typeof RunData.Type
  readonly meta: typeof Metadata.Type | null
}

export const RunSucceededMessage = Schema.Struct({
  _tag: Schema.Literal("RunSucceeded"),
  sequence: Schema.Number,
  finalizedAtMs: Schema.Number,
  data: RunData,
  meta: Schema.NullOr(Metadata)
})

export type RunResetMessage = {
  readonly _tag: "RunReset"
}

export const RunResetMessage = Schema.Struct({
  _tag: Schema.Literal("RunReset")
})

export const RunMessage = Schema.Union(
  RunStartedMessage,
  RunFrameUpdatedMessage,
  RunCanonicalFrameObservedMessage,
  RunChoreographyObservedMessage,
  RunStreamCompleteObservedMessage,
  RunStepQueueDrainedMessage,
  RunPauseCheckpointReachedMessage,
  RunPausedMessage,
  RunResumedMessage,
  RunStoppingMessage,
  RunStoppedMessage,
  RunFailedMessage,
  RunSucceededMessage,
  RunResetMessage
)

export type RunMessage =
  | RunStartedMessage
  | RunFrameUpdatedMessage
  | RunCanonicalFrameObservedMessage
  | RunChoreographyObservedMessage
  | RunStreamCompleteObservedMessage
  | RunStepQueueDrainedMessage
  | RunPauseCheckpointReachedMessage
  | RunPausedMessage
  | RunResumedMessage
  | RunStoppingMessage
  | RunStoppedMessage
  | RunFailedMessage
  | RunSucceededMessage
  | RunResetMessage
