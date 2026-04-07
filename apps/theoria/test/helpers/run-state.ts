import type { DemoError } from "../../app/contracts/demo-error.js"
import type { Metadata } from "../../app/contracts/envelope.js"
import type { Program } from "../../app/contracts/presentation.js"
import type { SurfaceRunPlan } from "../../app/contracts/run-plan.js"
import type { RunData } from "../../app/contracts/run.js"
import type { LocalRunPlan } from "../../app/web/state/local-run.js"
import { initialSurfaceState, reduceRunState, type RunOwnership, type RunState } from "../../app/web/state/types.js"

const defaultRunOwnership: RunOwnership = {
  localDriver: true,
  serverStream: true
}

const baseRunState = (): RunState => initialSurfaceState("effect-text").run

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
  localRunPlan = null,
  ownership = defaultRunOwnership,
  program,
  runPlan = { id: "effect-text", manifest: null },
  sequence = 1,
  startedAtMs = 0,
  token = 1
}: {
  readonly localRunPlan?: LocalRunPlan | null
  readonly ownership?: RunOwnership
  readonly program: Program
  readonly runPlan?: SurfaceRunPlan
  readonly sequence?: number
  readonly startedAtMs?: number
  readonly token?: number
}): RunState =>
  reduceRunState(baseRunState(), {
    _tag: "RunStarted",
    token,
    sequence,
    ownership,
    startedAtMs,
    runPlan,
    localRunPlan,
    program
  })

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
  readonly error: DemoError
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
  const withSuccessGate = ownership.localDriver
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
