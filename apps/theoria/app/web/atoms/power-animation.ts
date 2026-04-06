import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Stream } from "effect"
import { Effect, Queue } from "effect"
import { Study } from "effect-search"

import type { CanonicalFrame } from "../../contracts/canonical-step.js"
import { DemoExecutionError } from "../../contracts/demo-error.js"
import type { EffectMathCanonicalStep, PowerControls, PowerProjection } from "../../contracts/demo/power.js"
import {
  defaultPowerControls,
  type EffectMathRunPlan,
  projectPowerProjection,
  snapshotEffectMathRunPlan
} from "../../contracts/demo/power.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import { type LocalDriverCompletedEvent, localDriverCompletedEvent } from "./local-driver-events.js"
import { awaitNextRunSignalChange, awaitRunSignal, type RunSignal } from "./run-lifecycle.js"
import type { RunRegistry } from "./run-registry-context.js"

const executionFailedError = (message: string): DemoExecutionError =>
  new DemoExecutionError({
    code: "execution-failed",
    message,
    retryable: true
  })

export { projectPowerProjection, snapshotEffectMathRunPlan }
export type { EffectMathRunPlan, PowerControls, PowerProjection }

export const powerControlsAtom: AtomType.Writable<PowerControls> = Atom.make<PowerControls>(defaultPowerControls)
export const powerAnimatingAtom: AtomType.Writable<boolean> = Atom.make(false)

export type EffectMathRunFrame = {
  readonly _tag: "effect-math"
  readonly controls: PowerControls
  readonly projection: PowerProjection
}

export const isEffectMathRunFrame = (frame: { readonly _tag: string } | null): frame is EffectMathRunFrame =>
  frame !== null && frame._tag === "effect-math"

export const powerProjectionAtom: AtomType.Atom<PowerProjection> = Atom.make(
  (get: AtomType.Context): PowerProjection => projectPowerProjection(get(powerControlsAtom))
)

export const setPowerAnimationPlayback = (
  registry: RunRegistry,
  isAnimating: boolean
): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    registry.set(powerAnimatingAtom, isAnimating)
  })

export const syncPowerFrameToControls = (
  registry: RunRegistry,
  frame: EffectMathRunFrame
): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    registry.set(powerControlsAtom, frame.controls)
  })

export const resetPowerAnimationState = (registry: RunRegistry): void => {
  registry.set(powerControlsAtom, defaultPowerControls)
  registry.set(powerAnimatingAtom, false)
}

export const resetPowerAnimationStateEffect = (registry: RunRegistry): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    resetPowerAnimationState(registry)
  })

type StreamCompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>
type AuthoredStepQueueEvent = CanonicalFrame | StreamCompletionEvent
type EffectMathAnimationEvent =
  | { readonly _tag: "LocalRunFrameUpdated"; readonly frame: EffectMathRunFrame }
  | LocalDriverCompletedEvent

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
    awaitNextRunSignalChange(signal).pipe(
      Effect.zipRight(awaitRunSignal(signal)),
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

const plannedSteps = (plan: EffectMathRunPlan): ReadonlyArray<PowerControls> =>
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
}): Effect.Effect<void, DemoExecutionError, never> =>
  awaitRunSignal(signal).pipe(
    Effect.zipRight(takeAuthoredStepQueueEvent({ signal, stepQueue })),
    Effect.flatMap((nextEvent) =>
      isStreamCompletionEvent(nextEvent)
        ? remainingSteps.length === 0
          ? emit(localDriverCompletedEvent)
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
                ? drainPowerFrames({
                  emit,
                  remainingSteps: remainingSteps.slice(1),
                  signal,
                  stepQueue
                })
                : emit(localDriverCompletedEvent)
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

export const makePowerAnimationStream = (
  registry: RunRegistry,
  signal: RunSignal,
  plan: EffectMathRunPlan,
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>
): Stream.Stream<EffectMathAnimationEvent, DemoExecutionError, never> =>
  Study.streamFromEmitter<
    EffectMathAnimationEvent,
    void,
    DemoExecutionError,
    never
  >((emit) =>
    setPowerAnimationPlayback(registry, true).pipe(
      Effect.zipRight(
        drainPowerFrames({
          emit,
          remainingSteps: plannedSteps(plan),
          signal,
          stepQueue
        })
      ),
      Effect.ensuring(resetPowerAnimationStateEffect(registry))
    )
  )
