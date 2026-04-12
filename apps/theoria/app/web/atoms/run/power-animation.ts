import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Stream } from "effect"
import { Data, Effect, Queue } from "effect"
import { Study } from "effect-search"

import type { EffectMathCanonicalStep } from "../../../contracts/capability/effect-math.js"
import {
  EffectMathProjectionScript,
  PowerControls,
  PowerProjection
} from "../../../contracts/capability/effect-math.js"
import { EntryExecutionError } from "../../../contracts/entry-error.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import type { RunRegistry } from "../run-registry-context.js"
import type { RunSignal } from "./lifecycle.js"
import { ProjectionDriverCompletedEvent } from "./projection-driver-events.js"

const executionFailedError = (message: string): EntryExecutionError =>
  EntryExecutionError.make({
    code: "execution-failed",
    message,
    retryable: true
  })

export { EffectMathProjectionScript, PowerControls, PowerProjection }

const defaultPowerAnimationControls = PowerControls.defaults()

export const powerControlsAtom: AtomType.Writable<PowerControls> = Atom.make(defaultPowerAnimationControls)
export const powerAnimatingAtom: AtomType.Writable<boolean> = Atom.make(false)

export type EffectMathRunFrame = {
  readonly _tag: "effect-math"
  readonly controls: PowerControls
  readonly projection: PowerProjection
}

export const isEffectMathRunFrame = (frame: { readonly _tag: string } | null): frame is EffectMathRunFrame =>
  frame !== null && frame._tag === "effect-math"

export const powerProjectionAtom: AtomType.Atom<PowerProjection> = Atom.make(
  (get: AtomType.Context): PowerProjection => PowerProjection.project(get(powerControlsAtom))
)

type StreamCompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>
type AuthoredStepQueueEvent = CanonicalFrame | StreamCompletionEvent
type EffectMathAnimationEvent =
  | { readonly _tag: "LocalRunFrameUpdated"; readonly frame: EffectMathRunFrame }
  | ProjectionDriverCompletedEvent

const isStreamCompletionEvent = (event: AuthoredStepQueueEvent): event is StreamCompletionEvent =>
  "_tag" in event && event._tag === "StreamComplete"

const isEffectMathCanonicalStep = (
  step: CanonicalFrame["step"]
): step is typeof EffectMathCanonicalStep.Type => step._tag === "EffectMathCanonicalStep"

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

const sameControls = (left: PowerControls, right: PowerControls): boolean =>
  left.d === right.d && left.n === right.n && left.alpha === right.alpha

const emitFrameUpdate = ({
  emit,
  step
}: {
  readonly emit: (event: EffectMathAnimationEvent) => Effect.Effect<void, never, never>
  readonly step: typeof EffectMathCanonicalStep.Type
}): Effect.Effect<void, never, never> =>
  emit({
    _tag: "LocalRunFrameUpdated",
    frame: {
      _tag: "effect-math",
      controls: step.controls,
      projection: step.projection
    }
  })

const plannedSteps = (plan: EffectMathProjectionScript): ReadonlyArray<PowerControls> =>
  plan.phases.flatMap((phase) => phase.steps)

const drainPowerFrames = ({
  emit,
  remainingSteps,
  signal,
  stepQueue
}: {
  readonly emit: (event: EffectMathAnimationEvent) => Effect.Effect<void, never, never>
  readonly remainingSteps: ReadonlyArray<PowerControls>
  readonly signal: RunSignal
  readonly stepQueue: Queue.Queue<AuthoredStepQueueEvent>
}): Effect.Effect<void, EntryExecutionError, never> =>
  signal.awaitRunning().pipe(
    Effect.zipRight(takeAuthoredStepQueueEvent({ signal, stepQueue })),
    Effect.flatMap((nextEvent) =>
      isStreamCompletionEvent(nextEvent)
        ? remainingSteps.length === 0
          ? emit(ProjectionDriverCompletedEvent.make())
          : Effect.fail(
            executionFailedError("effect-math run ended before every authored power frame arrived.")
          )
        : isEffectMathCanonicalStep(nextEvent.step)
        ? remainingSteps.length === 0
          ? drainPowerFrames({ emit, remainingSteps, signal, stepQueue })
          : sameControls(remainingSteps[0]!, nextEvent.step.controls)
          ? emitFrameUpdate({ emit, step: nextEvent.step }).pipe(
            Effect.zipRight(
              remainingSteps.length > 1
                ? signal.yieldProjectionFrame().pipe(
                  Effect.zipRight(
                    drainPowerFrames({
                      emit,
                      remainingSteps: remainingSteps.slice(1),
                      signal,
                      stepQueue
                    })
                  )
                )
                : emit(ProjectionDriverCompletedEvent.make())
            )
          )
          : Effect.fail(
            executionFailedError(
              `effect-math authored step drifted from the frozen run plan (expected d=${
                remainingSteps[0]!.d.toFixed(2)
              }, n=${remainingSteps[0]!.n}, α=${remainingSteps[0]!.alpha.toFixed(2)}).`
            )
          )
        : drainPowerFrames({ emit, remainingSteps, signal, stepQueue })
    )
  )

export class EffectMathAnimation extends Data.Class<EffectMathAnimation.Shape> {
  static make(animation: EffectMathAnimation.Shape): EffectMathAnimation {
    return new EffectMathAnimation(animation)
  }

  static setPlayback(
    registry: RunRegistry,
    isAnimating: boolean
  ): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      registry.set(powerAnimatingAtom, isAnimating)
    })
  }

  static syncFrameToControls(
    registry: RunRegistry,
    frame: EffectMathRunFrame
  ): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      registry.set(powerControlsAtom, frame.controls)
    })
  }

  static reset(registry: RunRegistry): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      registry.set(powerControlsAtom, defaultPowerAnimationControls)
      registry.set(powerAnimatingAtom, false)
    })
  }

  stream(): Stream.Stream<EffectMathAnimationEvent, EntryExecutionError, never> {
    return Study.streamFromEmitter<
      EffectMathAnimationEvent,
      void,
      EntryExecutionError,
      never
    >((emit) =>
      EffectMathAnimation.setPlayback(this.registry, true).pipe(
        Effect.zipRight(
          drainPowerFrames({
            emit,
            remainingSteps: plannedSteps(this.plan),
            signal: this.signal,
            stepQueue: this.stepQueue
          })
        ),
        Effect.ensuring(EffectMathAnimation.reset(this.registry))
      )
    )
  }
}

export namespace EffectMathAnimation {
  export interface Shape {
    readonly registry: RunRegistry
    readonly signal: RunSignal
    readonly plan: EffectMathProjectionScript
    readonly stepQueue: Queue.Queue<AuthoredStepQueueEvent>
  }
}
