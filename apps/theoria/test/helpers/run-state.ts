import { Schema } from "effect"

import type { EntryError } from "../../app/contracts/entry-error.js"
import { DurableFingerprint } from "../../app/contracts/entry/fingerprint.js"
import { type EntryId, workflowEntryId } from "../../app/contracts/entry/id.js"
import type { Metadata } from "../../app/contracts/envelope.js"
import type { Program } from "../../app/contracts/presentation/program.js"
import type { StudyDraft } from "../../app/contracts/study/registry.js"
import type { RunRequestIdentity } from "../../app/contracts/study/run-plan.js"
import type { RunData } from "../../app/contracts/study/run.js"
import type { LocalProjectionScript } from "../../app/web/state/run/local.js"
import type { RunMessage } from "../../app/web/state/run/messages.js"
import { reduceRunState } from "../../app/web/state/run/reducer.js"
import { RunOwnership, type RunState } from "../../app/web/state/run/types.js"
import { initialSurfaceState } from "../../app/web/state/surface/state.js"

const defaultRunOwnership = RunOwnership.sharedStreaming()

const durableFingerprint = (fill: string) =>
  Schema.decodeUnknownSync(DurableFingerprint)(`blake3-256:${fill.repeat(43).slice(0, 43)}`)

const identityForDraft = ({
  draft,
  runToken
}: {
  readonly draft: StudyDraft
  readonly runToken: string
}): RunRequestIdentity => ({
  entryId: draft.entryId,
  seedId: draft.seedId,
  runToken,
  inputFingerprint: durableFingerprint("a"),
  controlsFingerprint: durableFingerprint("b"),
  requestFingerprint: durableFingerprint("c")
})

const resolvedEntryId = ({
  draft,
  localProjectionScript
}: {
  readonly draft: StudyDraft | null
  readonly localProjectionScript: LocalProjectionScript | null
}): EntryId => draft?.entryId ?? localProjectionScript?._tag ?? workflowEntryId

const baseRunState = (id: EntryId): RunState => initialSurfaceState(id).run

export const runStartedMessage = ({
  draft,
  localProjectionScript = null,
  ownership = defaultRunOwnership,
  program,
  sequence = 1,
  startedAtMs = 0,
  token = 1
}: {
  readonly draft?: StudyDraft
  readonly localProjectionScript?: LocalProjectionScript | null
  readonly ownership?: RunOwnership
  readonly program: Program
  readonly sequence?: number
  readonly startedAtMs?: number
  readonly token?: number
}): RunMessage => {
  const entryId = resolvedEntryId({ draft: draft ?? null, localProjectionScript })
  const resolvedDraft = draft ?? initialSurfaceState(entryId).draft

  return {
    _tag: "RunStarted",
    token,
    sequence,
    ownership,
    startedAtMs,
    draft: resolvedDraft,
    identity: identityForDraft({ draft: resolvedDraft, runToken: `${resolvedDraft.entryId}:${token}` }),
    localProjectionScript,
    program
  }
}

export const streamCompletedRunState = ({
  observedAtMs = 1,
  meta = null,
  run,
  sequence = 1,
  summary
}: {
  readonly observedAtMs?: number
  readonly meta?: Metadata | null
  readonly run: RunState
  readonly sequence?: number
  readonly summary: string
}): RunState =>
  reduceRunState(run, {
    _tag: "RunStreamCompleteObserved",
    sequence,
    observedAtMs,
    summary,
    meta
  })

export const stepQueueDrainedRunState = ({
  observedAtMs = 1,
  run,
  sequence = 1
}: {
  readonly observedAtMs?: number
  readonly run: RunState
  readonly sequence?: number
}): RunState =>
  reduceRunState(run, {
    _tag: "RunStepQueueDrained",
    sequence,
    observedAtMs
  })

export const runningRunState = ({
  draft,
  localProjectionScript = null,
  ownership = defaultRunOwnership,
  program,
  sequence = 1,
  startedAtMs = 0,
  token = 1
}: {
  readonly draft?: StudyDraft
  readonly localProjectionScript?: LocalProjectionScript | null
  readonly ownership?: RunOwnership
  readonly program: Program
  readonly sequence?: number
  readonly startedAtMs?: number
  readonly token?: number
}): RunState =>
  (() => {
    const resolvedDraft = draft ??
      initialSurfaceState(resolvedEntryId({ draft: draft ?? null, localProjectionScript })).draft

    return reduceRunState(
      baseRunState(resolvedDraft.entryId),
      runStartedMessage({
        draft: resolvedDraft,
        localProjectionScript,
        ownership,
        program,
        sequence,
        startedAtMs,
        token
      })
    )
  })()

export const pausedRunState = ({
  ownership = defaultRunOwnership,
  program,
  requestedAtMs = 1,
  sequence = 1,
  token = 1
}: {
  readonly ownership?: RunOwnership
  readonly program: Program
  readonly requestedAtMs?: number
  readonly sequence?: number
  readonly token?: number
}): RunState =>
  reduceRunState(runningRunState({ ownership, program, sequence, token }), {
    _tag: "RunPaused",
    sequence,
    requestedAtMs
  })

export const failedRunState = ({
  error,
  finalizedAtMs = 2,
  ownership = defaultRunOwnership,
  program,
  sequence = 1,
  token = 1
}: {
  readonly error: EntryError
  readonly finalizedAtMs?: number
  readonly ownership?: RunOwnership
  readonly program: Program
  readonly sequence?: number
  readonly token?: number
}): RunState =>
  reduceRunState(runningRunState({ ownership, program, sequence, token }), {
    _tag: "RunFailed",
    sequence,
    finalizedAtMs,
    error
  })

export const succeededRunState = ({
  data,
  finalizedAtMs = 2,
  meta = null,
  ownership = defaultRunOwnership,
  sequence = 1,
  token = 1
}: {
  readonly data: RunData
  readonly finalizedAtMs?: number
  readonly meta?: Metadata | null
  readonly ownership?: RunOwnership
  readonly sequence?: number
  readonly token?: number
}): RunState => {
  const started = runningRunState({ ownership, program: data.program, sequence, token })
  const withStreamCompletion = ownership.serverStream
    ? streamCompletedRunState({ run: started, sequence, summary: data.summary, meta })
    : started
  const withSuccessGate = ownership.projectionDriver
    ? stepQueueDrainedRunState({ run: withStreamCompletion, sequence })
    : withStreamCompletion

  return reduceRunState(withSuccessGate, {
    _tag: "RunSucceeded",
    sequence,
    finalizedAtMs,
    data,
    meta
  })
}
