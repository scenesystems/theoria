import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Stream } from "effect"
import { Clock, Effect, Option, Ref, Schema } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"
import * as Arr from "effect/Array"

import { DemoExecutionError } from "../../contracts/demo-error.js"
import {
  bestTrialPoint,
  defaultSamplerSeed,
  defaultTrialBudget,
  objectiveAt,
  objectiveExpression,
  optimum,
  searchBounds,
  type TrialPoint
} from "../../contracts/demo/objective.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import { SectionAppend } from "../../contracts/evidence-stream.js"
import { type LocalDriverCompletedEvent, localDriverCompletedEvent } from "./local-driver-events.js"
import { publishOptimizationEvidence } from "./optimization-evidence.js"
import { awaitRunSignal, type RunSignal, sleepWithRunSignal } from "./run-lifecycle.js"
import type { RunRegistry } from "./run-registry-context.js"

import type { Config2D } from "../../contracts/demo/objective.js"

const objective = (config: Config2D) => Effect.succeed(objectiveAt(config))

const executionFailedError = (message: string): DemoExecutionError =>
  new DemoExecutionError({
    code: "execution-failed",
    message,
    retryable: true
  })

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

export type { TrialPoint } from "../../contracts/demo/objective.js"

export type EffectSearchRunPlan = {
  readonly _tag: "effect-search"
  readonly samplerSeed: number
  readonly trialBudget: number
}

export type EffectSearchRunFrame = {
  readonly _tag: "effect-search"
  readonly phase: OptimizationProjection["phase"]
  readonly randomBestValue: number | null
  readonly randomTrialCount: number
  readonly tpeBestValue: number | null
  readonly tpeTrialCount: number
  readonly trialBudget: number
}

export const snapshotEffectSearchRunPlan = (trialBudget: number): EffectSearchRunPlan => ({
  _tag: "effect-search",
  samplerSeed: defaultSamplerSeed,
  trialBudget
})

export const trialBudgetAtom: AtomType.Writable<number> = Atom.make(defaultTrialBudget)

export const optimizationAnimatingAtom: AtomType.Writable<boolean> = Atom.make(false)

export const tpeTrialsAtom: AtomType.Writable<ReadonlyArray<TrialPoint>> = Atom.make<ReadonlyArray<TrialPoint>>([])

export const randomTrialsAtom: AtomType.Writable<ReadonlyArray<TrialPoint>> = Atom.make<ReadonlyArray<TrialPoint>>([])

// ---------------------------------------------------------------------------
// Derived projection
// ---------------------------------------------------------------------------

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

export const optimizationProjectionAtom: AtomType.Atom<OptimizationProjection> = Atom.make(
  (get: AtomType.Context): OptimizationProjection => {
    const tpeTrials = get(tpeTrialsAtom)
    const randomTrials = get(randomTrialsAtom)
    const isAnimating = get(optimizationAnimatingAtom)
    const trialBudget = get(trialBudgetAtom)
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
      phase: isAnimating ? "running" : tpeTrials.length > 0 ? "complete" : "idle"
    }
  }
)

// ---------------------------------------------------------------------------
// Ask/tell animation — step-by-step trial sweep with render yields
// ---------------------------------------------------------------------------

const stepDelayMs = 40

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

type OptimizationAnimationEvent = EvidenceEvent | LocalDriverCompletedEvent

export const makeOptimizationAnimationStream = (
  registry: RunRegistry,
  signal: RunSignal,
  plan: EffectSearchRunPlan
): Stream.Stream<OptimizationAnimationEvent, DemoExecutionError, never> =>
  Study.streamFromEmitter<OptimizationAnimationEvent, void, DemoExecutionError, never>((emit) =>
    Effect.gen(function*() {
      registry.set(optimizationAnimatingAtom, true)
      registry.set(tpeTrialsAtom, [])
      registry.set(randomTrialsAtom, [])

      const startedAt = yield* Clock.currentTimeMillis
      const trialBudget = plan.trialBudget
      const seed = plan.samplerSeed

      const tpePointsRef = yield* Ref.make<ReadonlyArray<TrialPoint>>([])
      const randomPointsRef = yield* Ref.make<ReadonlyArray<TrialPoint>>([])
      const publishedTrialCountRef = yield* Ref.make(0)

      yield* Effect.scoped(
        Effect.gen(function*() {
          const space = yield* SearchSpace.make({
            x: SearchSpace.float(searchBounds.xMin, searchBounds.xMax),
            y: SearchSpace.float(searchBounds.yMin, searchBounds.yMax)
          })
          const tpeHandle = yield* Study.open({
            space,
            sampler: Sampler.tpe({ seed }),
            objective,
            trials: trialBudget,
            direction: "minimize"
          })
          const randomHandle = yield* Study.open({
            space,
            sampler: Sampler.random({ seed }),
            objective,
            trials: trialBudget,
            direction: "minimize"
          })

          const recordSamplerStep = ({
            handle,
            index,
            trialRef
          }: {
            readonly handle: Study.StudyHandle<typeof space>
            readonly index: number
            readonly trialRef: Ref.Ref<ReadonlyArray<TrialPoint>>
          }) =>
            Effect.gen(function*() {
              const asked = yield* Study.ask(handle)
              const config = yield* Schema.decodeUnknown(space.schema)(asked.config)
              const value = yield* objective(config)
              yield* Study.tell(handle, asked.trialNumber, value)

              const point: TrialPoint = { x: config.x, y: config.y, value, index }
              return yield* Ref.updateAndGet(trialRef, Arr.append(point))
            })

          yield* Effect.forEach(
            Arr.range(0, trialBudget - 1),
            (index) =>
              Effect.gen(function*() {
                // Advance both samplers in one frame so the optimizer page stays interruptible.
                yield* awaitRunSignal(signal)
                const tpePoints = yield* recordSamplerStep({
                  handle: tpeHandle,
                  index,
                  trialRef: tpePointsRef
                })
                yield* awaitRunSignal(signal)
                const randomPoints = yield* recordSamplerStep({
                  handle: randomHandle,
                  index,
                  trialRef: randomPointsRef
                })

                registry.set(tpeTrialsAtom, tpePoints)
                registry.set(randomTrialsAtom, randomPoints)

                if (index === 0) {
                  yield* publishOptimizationEvidence({
                    emit,
                    force: false,
                    publishedTrialCountRef,
                    randomPointsRef,
                    tpePointsRef
                  })
                  yield* sleepWithRunSignal(signal, stepDelayMs)
                } else {
                  yield* sleepWithRunSignal(signal, stepDelayMs)
                  yield* publishOptimizationEvidence({
                    emit,
                    force: false,
                    publishedTrialCountRef,
                    randomPointsRef,
                    tpePointsRef
                  })
                }
              }),
            { concurrency: 1, discard: true }
          )

          yield* publishOptimizationEvidence({
            emit,
            force: true,
            publishedTrialCountRef,
            randomPointsRef,
            tpePointsRef
          })
        }).pipe(
          Effect.mapError(() => executionFailedError("effect-search animation failed before local completion."))
        )
      )

      const endedAt = yield* Clock.currentTimeMillis

      yield* emit(
        new SectionAppend({
          section: {
            title: "Animation Summary",
            items: [
              { _tag: "Scalar", label: "Trials per sampler", value: trialBudget, unit: "trials", format: "integer" },
              { _tag: "Scalar", label: "Animation duration", value: endedAt - startedAt, unit: "ms", format: "fixed" },
              { _tag: "Text", label: "Objective", value: objectiveExpression },
              { _tag: "Text", label: "Optimum", value: `(${optimum.x}, ${optimum.y}) → 0` },
              {
                _tag: "Text",
                label: "Proof",
                value:
                  "Both optimizations advanced in lockstep via ask/tell while the transcript coalesced trial-table upserts into batched checkpoints so the live controls stayed responsive under load."
              }
            ]
          }
        })
      )
      yield* setOptimizationAnimationPlayback(registry, false)
      yield* emit(localDriverCompletedEvent)
    }).pipe(
      Effect.ensuring(resetOptimizationAnimationState(registry))
    )
  )
