import { Effect, Queue } from "effect"
import { Study } from "effect-search"

import { DspRunFrame } from "../../contracts/capability/effect-dsp-runtime.js"
import type { EvidenceEvent } from "../../contracts/evidence/stream.js"
import type { CanonicalFrame } from "../../contracts/study/workflow/canonical-step.js"

import { type LocalDriverCompletedEvent, localDriverCompletedEvent } from "./local-driver-events.js"
import { awaitNextRunSignalChange, awaitRunSignal, type RunSignal, yieldProjectionFrame } from "./run/lifecycle.js"

type StreamCompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>
type AuthoredStepQueueEvent = CanonicalFrame | StreamCompletionEvent
type DspLocalDriverEvent = {
  readonly _tag: "LocalRunFrameUpdated"
  readonly frame: DspRunFrame
} | LocalDriverCompletedEvent

const isStreamCompletionEvent = (event: AuthoredStepQueueEvent): event is StreamCompletionEvent =>
  "_tag" in event && event._tag === "StreamComplete"

const isDspCanonicalStep = (
  step: CanonicalFrame["step"]
): step is Extract<CanonicalFrame["step"], { readonly _tag: "DspCanonicalStep" }> => step._tag === "DspCanonicalStep"

const frameForStep = (step: Extract<CanonicalFrame["step"], { readonly _tag: "DspCanonicalStep" }>) =>
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
      isStreamCompletionEvent(nextEvent)
        ? emit(localDriverCompletedEvent)
        : isDspCanonicalStep(nextEvent.step)
        ? awaitRunSignal(signal).pipe(
          Effect.zipRight(
            emit({
              _tag: "LocalRunFrameUpdated",
              frame: frameForStep(nextEvent.step)
            })
          ),
          Effect.zipRight(yieldProjectionFrame(signal)),
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
