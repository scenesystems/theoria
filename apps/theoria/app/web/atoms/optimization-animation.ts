import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Stream } from "effect"
import { Effect, Queue } from "effect"
import { Study } from "effect-search"
import * as Option from "effect/Option"

import type { CanonicalFrame } from "../../contracts/canonical-step.js"
import { DemoExecutionError } from "../../contracts/demo-error.js"
import type { EffectSearchStudyTelemetry } from "../../contracts/demo/effect-search-study-telemetry.js"
import type { EffectSearchCanonicalStep } from "../../contracts/demo/objective.js"
import {
  type EffectSearchRunPlan,
  snapshotEffectSearchRunPlan,
  type TrialPoint
} from "../../contracts/demo/objective.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import { type LocalDriverCompletedEvent, localDriverCompletedEvent } from "./local-driver-events.js"
import { awaitNextRunSignalChange, awaitRunSignal, type RunSignal, yieldProjectionFrame } from "./run-lifecycle.js"
import type { RunRegistry } from "./run-registry-context.js"

const executionFailedError = (message: string): DemoExecutionError =>
  new DemoExecutionError({
    code: "execution-failed",
    message,
    retryable: true
  })

export { snapshotEffectSearchRunPlan }
export type { EffectSearchRunPlan, TrialPoint }

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

export type OptimizationProjection = {
  readonly trialBudget: number
  readonly tpeTrials: ReadonlyArray<TrialPoint>
  readonly randomTrials: ReadonlyArray<TrialPoint>
  readonly tpeBestValue: Option.Option<number>
  readonly randomBestValue: Option.Option<number>
  readonly tpeBestPoint: Option.Option<TrialPoint>
  readonly randomBestPoint: Option.Option<TrialPoint>
  readonly phase: "idle" | "running" | "complete"
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

export const makeOptimizationProjection = ({
  phase,
  randomTrials,
  tpeTrials,
  trialBudget
}: {
  readonly phase: OptimizationProjection["phase"]
  readonly randomTrials: ReadonlyArray<TrialPoint>
  readonly tpeTrials: ReadonlyArray<TrialPoint>
  readonly trialBudget: number
}): OptimizationProjection => {
  const tpeBest = bestTrialPoint(tpeTrials)
  const randomBest = bestTrialPoint(randomTrials)

  return {
    trialBudget,
    tpeTrials,
    randomTrials,
    tpeBestValue: Option.map(tpeBest, (point) => point.value),
    randomBestValue: Option.map(randomBest, (point) => point.value),
    tpeBestPoint: tpeBest,
    randomBestPoint: randomBest,
    phase
  }
}

export const optimizationProjectionAtom: AtomType.Atom<OptimizationProjection> = Atom.make(
  (get: AtomType.Context): OptimizationProjection => {
    const tpeTrials = get(tpeTrialsAtom)
    const randomTrials = get(randomTrialsAtom)
    const isAnimating = get(optimizationAnimatingAtom)
    const trialBudget = get(trialBudgetAtom)

    return makeOptimizationProjection({
      phase: isAnimating ? "running" : tpeTrials.length > 0 ? "complete" : "idle",
      randomTrials,
      tpeTrials,
      trialBudget
    })
  }
)

export const setOptimizationAnimationPlayback = (
  registry: RunRegistry,
  isAnimating: boolean
): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    registry.set(optimizationAnimatingAtom, isAnimating)
  })

export const resetOptimizationAnimationState = (registry: RunRegistry): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    registry.set(optimizationAnimatingAtom, false)
    registry.set(tpeTrialsAtom, [])
    registry.set(randomTrialsAtom, [])
  })

type StreamCompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>
type AuthoredStepQueueEvent = CanonicalFrame | StreamCompletionEvent
type EffectSearchAnimationEvent =
  | { readonly _tag: "LocalRunFrameUpdated"; readonly frame: EffectSearchRunFrame }
  | LocalDriverCompletedEvent

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
    awaitNextRunSignalChange(signal).pipe(
      Effect.zipRight(awaitRunSignal(signal)),
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
  const projection = makeOptimizationProjection({
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
  readonly plan: EffectSearchRunPlan
  readonly registry: RunRegistry
  readonly remaining: number
  readonly signal: RunSignal
  readonly stepQueue: Queue.Queue<AuthoredStepQueueEvent>
}): Effect.Effect<void, DemoExecutionError, never> =>
  awaitRunSignal(signal).pipe(
    Effect.zipRight(takeAuthoredStepQueueEvent({ signal, stepQueue })),
    Effect.flatMap((nextEvent) =>
      isStreamCompletionEvent(nextEvent)
        ? remaining === 0
          ? emit(localDriverCompletedEvent)
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
                ? yieldProjectionFrame(signal).pipe(
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
                : emit(localDriverCompletedEvent)
            )
          )
        : drainSearchFrames({ emit, plan, registry, remaining, signal, stepQueue })
    )
  )

export const makeOptimizationAnimationStream = (
  registry: RunRegistry,
  signal: RunSignal,
  plan: EffectSearchRunPlan,
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>
): Stream.Stream<EffectSearchAnimationEvent, DemoExecutionError, never> =>
  Study.streamFromEmitter<
    EffectSearchAnimationEvent,
    void,
    DemoExecutionError,
    never
  >((emit) =>
    setOptimizationAnimationPlayback(registry, true).pipe(
      Effect.zipRight(
        drainSearchFrames({
          emit,
          plan,
          registry,
          remaining: plan.trialBudget,
          signal,
          stepQueue
        })
      ),
      Effect.ensuring(resetOptimizationAnimationState(registry))
    )
  )
