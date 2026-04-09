import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Stream } from "effect"
import { Data, Effect, Queue } from "effect"
import { Study } from "effect-search"
import * as Option from "effect/Option"

import type { EffectSearchStudyTelemetry } from "../../../contracts/capability/effect-search-study-telemetry.js"
import type { EffectSearchCanonicalStep } from "../../../contracts/capability/effect-search.js"
import {
  type EffectSearchProjectionScript,
  snapshotEffectSearchProjectionScript,
  type TrialPoint
} from "../../../contracts/capability/effect-search.js"
import { EntryExecutionError } from "../../../contracts/entry-error.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import type { RunRegistry } from "../run-registry-context.js"
import type { RunSignal } from "./lifecycle.js"
import { type ProjectionDriverCompletedEvent, projectionDriverCompletedEvent } from "./projection-driver-events.js"

const executionFailedError = (message: string): EntryExecutionError =>
  EntryExecutionError.make({
    code: "execution-failed",
    message,
    retryable: true
  })

export { snapshotEffectSearchProjectionScript }
export type { EffectSearchProjectionScript, TrialPoint }

export type EffectSearchRunFrame = {
  readonly _tag: "effect-search"
  readonly projection: OptimizationProjection
  readonly telemetry: EffectSearchStudyTelemetry
}

export const isEffectSearchRunFrame = (frame: { readonly _tag: string } | null): frame is EffectSearchRunFrame =>
  frame !== null && frame._tag === "effect-search"

export const trialBudgetAtom: AtomType.Writable<number> = Atom.make(30)
export const optimizationAnimatingAtom: AtomType.Writable<boolean> = Atom.make(false)
export const tpeTrialsAtom: AtomType.Writable<ReadonlyArray<TrialPoint>> = Atom.make<ReadonlyArray<TrialPoint>>([])
export const randomTrialsAtom: AtomType.Writable<ReadonlyArray<TrialPoint>> = Atom.make<ReadonlyArray<TrialPoint>>([])

export class OptimizationProjection extends Data.Class<OptimizationProjection.Shape> {
  static make(projection: OptimizationProjection.Shape): OptimizationProjection {
    return new OptimizationProjection(projection)
  }

  static fromTrials({
    phase,
    randomTrials,
    tpeTrials,
    trialBudget
  }: {
    readonly phase: OptimizationProjection.Shape["phase"]
    readonly randomTrials: ReadonlyArray<TrialPoint>
    readonly tpeTrials: ReadonlyArray<TrialPoint>
    readonly trialBudget: number
  }): OptimizationProjection {
    const tpeBest = bestTrialPoint(tpeTrials)
    const randomBest = bestTrialPoint(randomTrials)

    return OptimizationProjection.make({
      trialBudget,
      tpeTrials,
      randomTrials,
      tpeBestValue: Option.map(tpeBest, (point) => point.value),
      randomBestValue: Option.map(randomBest, (point) => point.value),
      tpeBestPoint: tpeBest,
      randomBestPoint: randomBest,
      phase
    })
  }
}

export namespace OptimizationProjection {
  export interface Shape {
    readonly trialBudget: number
    readonly tpeTrials: ReadonlyArray<TrialPoint>
    readonly randomTrials: ReadonlyArray<TrialPoint>
    readonly tpeBestValue: Option.Option<number>
    readonly randomBestValue: Option.Option<number>
    readonly tpeBestPoint: Option.Option<TrialPoint>
    readonly randomBestPoint: Option.Option<TrialPoint>
    readonly phase: "idle" | "running" | "complete"
  }
}

const bestTrialPoint = (trials: ReadonlyArray<TrialPoint>): Option.Option<TrialPoint> =>
  trials.reduce<Option.Option<TrialPoint>>(
    (best, trial) =>
      Option.match(best, {
        onNone: () => Option.some(trial),
        onSome: (currentBest) => Option.some(trial.value < currentBest.value ? trial : currentBest)
      }),
    Option.none()
  )

export const optimizationProjectionAtom: AtomType.Atom<OptimizationProjection> = Atom.make(
  (get: AtomType.Context): OptimizationProjection => {
    const tpeTrials = get(tpeTrialsAtom)
    const randomTrials = get(randomTrialsAtom)
    const isAnimating = get(optimizationAnimatingAtom)
    const trialBudget = get(trialBudgetAtom)

    return OptimizationProjection.fromTrials({
      phase: isAnimating ? "running" : tpeTrials.length > 0 ? "complete" : "idle",
      randomTrials,
      tpeTrials,
      trialBudget
    })
  }
)

type StreamCompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>
type AuthoredStepQueueEvent = CanonicalFrame | StreamCompletionEvent
type EffectSearchAnimationEvent =
  | { readonly _tag: "LocalRunFrameUpdated"; readonly frame: EffectSearchRunFrame }
  | ProjectionDriverCompletedEvent

const isStreamCompletionEvent = (event: AuthoredStepQueueEvent): event is StreamCompletionEvent =>
  "_tag" in event && event._tag === "StreamComplete"

const isEffectSearchCanonicalStep = (
  step: CanonicalFrame["step"]
): step is typeof EffectSearchCanonicalStep.Type => step._tag === "EffectSearchCanonicalStep"

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

const emitFrameUpdate = ({
  emit,
  registry,
  step
}: {
  readonly emit: (event: EffectSearchAnimationEvent) => Effect.Effect<void, never, never>
  readonly registry: RunRegistry
  readonly step: typeof EffectSearchCanonicalStep.Type
}): Effect.Effect<void, never, never> => {
  const projection = OptimizationProjection.fromTrials({
    phase: step.phase,
    randomTrials: step.randomTrials,
    tpeTrials: step.tpeTrials,
    trialBudget: step.trialBudget
  })

  return Effect.sync(() => {
    registry.set(tpeTrialsAtom, step.tpeTrials)
    registry.set(randomTrialsAtom, step.randomTrials)
  }).pipe(
    Effect.zipRight(
      emit({
        _tag: "LocalRunFrameUpdated",
        frame: {
          _tag: "effect-search",
          projection,
          telemetry: step.telemetry
        }
      })
    )
  )
}

const drainSearchFrames = ({
  emit,
  plan,
  registry,
  remaining,
  signal,
  stepQueue
}: {
  readonly emit: (event: EffectSearchAnimationEvent) => Effect.Effect<void, never, never>
  readonly plan: EffectSearchProjectionScript
  readonly registry: RunRegistry
  readonly remaining: number
  readonly signal: RunSignal
  readonly stepQueue: Queue.Queue<AuthoredStepQueueEvent>
}): Effect.Effect<void, EntryExecutionError, never> =>
  signal.awaitRunning().pipe(
    Effect.zipRight(takeAuthoredStepQueueEvent({ signal, stepQueue })),
    Effect.flatMap((nextEvent) =>
      isStreamCompletionEvent(nextEvent)
        ? remaining === 0
          ? emit(projectionDriverCompletedEvent)
          : Effect.fail(
            executionFailedError("effect-search run ended before every authored optimization frame arrived.")
          )
        : isEffectSearchCanonicalStep(nextEvent.step)
        ? nextEvent.step.trialBudget !== plan.trialBudget
          ? Effect.fail(
            executionFailedError(
              `effect-search authored step drifted from the frozen run plan (expected trialBudget=${plan.trialBudget}; received ${nextEvent.step.trialBudget}).`
            )
          )
          : emitFrameUpdate({ emit, registry, step: nextEvent.step }).pipe(
            Effect.zipRight(
              remaining > 1
                ? signal.yieldProjectionFrame().pipe(
                  Effect.zipRight(
                    drainSearchFrames({
                      emit,
                      plan,
                      registry,
                      remaining: remaining - 1,
                      signal,
                      stepQueue
                    })
                  )
                )
                : emit(projectionDriverCompletedEvent)
            )
          )
        : drainSearchFrames({ emit, plan, registry, remaining, signal, stepQueue })
    )
  )

export class EffectSearchAnimation extends Data.Class<EffectSearchAnimation.Shape> {
  static make(animation: EffectSearchAnimation.Shape): EffectSearchAnimation {
    return new EffectSearchAnimation(animation)
  }

  static setPlayback(
    registry: RunRegistry,
    isAnimating: boolean
  ): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      registry.set(optimizationAnimatingAtom, isAnimating)
    })
  }

  static reset(registry: RunRegistry): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      registry.set(optimizationAnimatingAtom, false)
      registry.set(tpeTrialsAtom, [])
      registry.set(randomTrialsAtom, [])
    })
  }

  stream(): Stream.Stream<EffectSearchAnimationEvent, EntryExecutionError, never> {
    return Study.streamFromEmitter<
      EffectSearchAnimationEvent,
      void,
      EntryExecutionError,
      never
    >((emit) =>
      EffectSearchAnimation.setPlayback(this.registry, true).pipe(
        Effect.zipRight(
          drainSearchFrames({
            emit,
            plan: this.plan,
            registry: this.registry,
            remaining: this.plan.trialBudget,
            signal: this.signal,
            stepQueue: this.stepQueue
          })
        ),
        Effect.ensuring(EffectSearchAnimation.reset(this.registry))
      )
    )
  }
}

export namespace EffectSearchAnimation {
  export interface Shape {
    readonly registry: RunRegistry
    readonly signal: RunSignal
    readonly plan: EffectSearchProjectionScript
    readonly stepQueue: Queue.Queue<AuthoredStepQueueEvent>
  }
}
