import { Effect, Queue } from "effect"
import { Study } from "effect-search"

import type { CanonicalStep } from "../../contracts/canonical-step.js"
import { DspRunFrame } from "../../contracts/demo/dsp-runtime.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"

import { awaitNextRunSignalChange, awaitRunSignal, type RunSignal } from "./run-lifecycle.js"

type StreamCompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>
type AuthoredStepQueueEvent = CanonicalStep | StreamCompletionEvent
type DspLocalDriverEvent = {
  readonly _tag: "LocalRunFrameUpdated"
  readonly frame: DspRunFrame
}

const frameForStep = (step: Extract<CanonicalStep, { readonly _tag: "DspCanonicalStep" }>) =>
  new DspRunFrame({
    scenarioId: step.scenarioId,
    stageId: step.stageId,
    stepIndex: step.stepIndex,
    stepCount: step.stepCount,
    metrics: step.metrics
  })

const takeAuthoredStepQueueEvent = ({
  signal,
  stepQueue
}: {
  readonly signal: RunSignal
  readonly stepQueue: Queue.Queue<AuthoredStepQueueEvent>
}): Effect.Effect<AuthoredStepQueueEvent, never, never> =>
  Effect.raceFirst(
    Queue.take(stepQueue),
    awaitNextRunSignalChange(signal).pipe(
      Effect.zipRight(awaitRunSignal(signal)),
      Effect.flatMap(() => takeAuthoredStepQueueEvent({ signal, stepQueue }))
    )
  )

const drainAuthoredSteps = ({
  emit,
  signal,
  stepQueue
}: {
  readonly emit: (event: DspLocalDriverEvent) => Effect.Effect<void, never, never>
  readonly signal: RunSignal
  readonly stepQueue: Queue.Queue<AuthoredStepQueueEvent>
}): Effect.Effect<void, never, never> =>
  takeAuthoredStepQueueEvent({ signal, stepQueue }).pipe(
    Effect.flatMap((nextEvent) =>
      nextEvent._tag === "StreamComplete"
        ? Effect.void
        : nextEvent._tag === "DspCanonicalStep"
        ? awaitRunSignal(signal).pipe(
          Effect.zipRight(
            emit({
              _tag: "LocalRunFrameUpdated",
              frame: frameForStep(nextEvent)
            })
          ),
          Effect.zipRight(drainAuthoredSteps({ emit, signal, stepQueue }))
        )
        : drainAuthoredSteps({ emit, signal, stepQueue })
    )
  )

export const makeDspRunStream = (
  signal: RunSignal,
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>
) =>
  Study.streamFromEmitter<DspLocalDriverEvent, void, never, never>((emit) =>
    drainAuthoredSteps({ emit, signal, stepQueue })
  )
