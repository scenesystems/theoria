import type { DemoError } from "../../../contracts/demo-error.js"
import type { EntryDraft } from "../../../contracts/entry/registry.js"
import type { Metadata } from "../../../contracts/envelope.js"
import type { Program } from "../../../contracts/presentation/program.js"
import type { EntryRunIdentity } from "../../../contracts/study/run-plan.js"
import type { RunData } from "../../../contracts/study/run.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import type { ChoreographyCue, ChoreographyState } from "../../../contracts/study/workflow/choreography.js"

import type { LocalProjectionScript, LocalRunFrame } from "./local.js"
import type { RunOwnership } from "./types.js"

export type RunMessage =
  | {
    readonly _tag: "RunStarted"
    readonly token: number
    readonly sequence: number
    readonly ownership: RunOwnership
    readonly startedAtMs: number
    readonly draft: EntryDraft
    readonly identity: EntryRunIdentity
    readonly localProjectionScript: LocalProjectionScript | null
    readonly program: Program
  }
  | {
    readonly _tag: "RunFrameUpdated"
    readonly sequence: number
    readonly frame: LocalRunFrame
  }
  | {
    readonly _tag: "RunCanonicalFrameObserved"
    readonly sequence: number
    readonly frame: CanonicalFrame
  }
  | {
    readonly _tag: "RunChoreographyObserved"
    readonly sequence: number
    readonly cue: ChoreographyCue
    readonly state: ChoreographyState
  }
  | {
    readonly _tag: "RunStreamCompleteObserved"
    readonly sequence: number
    readonly observedAtMs: number
    readonly summary: string
    readonly meta: Metadata | null
  }
  | { readonly _tag: "RunStepQueueDrained"; readonly sequence: number; readonly observedAtMs: number }
  | { readonly _tag: "RunPauseCheckpointReached"; readonly sequence: number; readonly observedAtMs: number }
  | { readonly _tag: "RunPaused"; readonly sequence: number; readonly requestedAtMs: number }
  | { readonly _tag: "RunResumed"; readonly sequence: number; readonly requestedAtMs: number }
  | { readonly _tag: "RunStopping"; readonly sequence: number; readonly requestedAtMs: number }
  | { readonly _tag: "RunStopped"; readonly sequence: number; readonly stoppedAtMs: number }
  | { readonly _tag: "RunFailed"; readonly sequence: number; readonly finalizedAtMs: number; readonly error: DemoError }
  | {
    readonly _tag: "RunSucceeded"
    readonly sequence: number
    readonly finalizedAtMs: number
    readonly data: RunData
    readonly meta: Metadata | null
  }
  | { readonly _tag: "RunReset" }
