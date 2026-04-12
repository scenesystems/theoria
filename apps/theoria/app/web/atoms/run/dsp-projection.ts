import { Data, Effect, Queue } from "effect"
import { Study } from "effect-search"

import { DspRunFrame } from "../../../contracts/capability/effect-dsp-runtime.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"

import type { RunSignal } from "./lifecycle.js"
import { ProjectionDriverCompletedEvent } from "./projection-driver-events.js"

type StreamCompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>
type AuthoredStepQueueEvent = CanonicalFrame | StreamCompletionEvent
type EffectDspProjectionEvent = {
  readonly _tag: "LocalRunFrameUpdated"
  readonly frame: DspRunFrame
} | ProjectionDriverCompletedEvent

const isStreamCompletionEvent = (event: AuthoredStepQueueEvent): event is StreamCompletionEvent =>
  "_tag" in event && event._tag === "StreamComplete"

const isDspCanonicalStep = (
  step: CanonicalFrame["step"]
): step is Extract<CanonicalFrame["step"], { readonly _tag: "DspCanonicalStep" }> => step._tag === "DspCanonicalStep"

const frameForStep = (step: Extract<CanonicalFrame["step"], { readonly _tag: "DspCanonicalStep" }>) =>
  DspRunFrame.make({
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
    signal.awaitNextChange().pipe(
      Effect.zipRight(signal.awaitRunning()),
      Effect.flatMap(() => takeAuthoredStepQueueEvent({ signal, stepQueue }))
    )
  )

const drainAuthoredSteps = ({
  emit,
  signal,
  stepQueue
}: {
  readonly emit: (event: EffectDspProjectionEvent) => Effect.Effect<void, never, never>
  readonly signal: RunSignal
  readonly stepQueue: Queue.Queue<AuthoredStepQueueEvent>
}): Effect.Effect<void, never, never> =>
  takeAuthoredStepQueueEvent({ signal, stepQueue }).pipe(
    Effect.flatMap((nextEvent) =>
      isStreamCompletionEvent(nextEvent)
        ? emit(ProjectionDriverCompletedEvent.make())
        : isDspCanonicalStep(nextEvent.step)
        ? signal.awaitRunning().pipe(
          Effect.zipRight(
            emit({
              _tag: "LocalRunFrameUpdated",
              frame: frameForStep(nextEvent.step)
            })
          ),
          Effect.zipRight(signal.yieldProjectionFrame()),
          Effect.zipRight(drainAuthoredSteps({ emit, signal, stepQueue }))
        )
        : drainAuthoredSteps({ emit, signal, stepQueue })
    )
  )

export class EffectDspProjection extends Data.Class<EffectDspProjection.Shape> {
  static make(projection: EffectDspProjection.Shape): EffectDspProjection {
    return new EffectDspProjection(projection)
  }

  stream() {
    return Study.streamFromEmitter<EffectDspProjectionEvent, void, never, never>((emit) =>
      drainAuthoredSteps({ emit, signal: this.signal, stepQueue: this.stepQueue })
    )
  }
}

export namespace EffectDspProjection {
  export interface Shape {
    readonly signal: RunSignal
    readonly stepQueue: Queue.Queue<AuthoredStepQueueEvent>
  }
}
