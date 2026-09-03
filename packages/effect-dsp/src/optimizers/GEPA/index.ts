/**
 * Evolves module instructions through reflective mutation, common-ancestor
 * merges, and Pareto-weighted parent selection.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Effect, Match, Option, Ref } from "effect"
import type { Schema } from "effect"
import { nextDeterministicSeed, normalizeDeterministicSeed } from "../../contracts/DeterministicSeed.js"
import { withModuleParamsInstructions } from "../../contracts/ModuleParams.js"
import { GEPAEvent } from "./events.js"
import { GEPAState, PredictorInstruction, ProgramCandidate } from "./model.js"
import { deriveParetoKernelSnapshot } from "./pareto.js"
import { evaluateCandidate } from "./runtime/evaluate.js"
import { instructionForPredictor } from "./runtime/helpers.js"
import { runMergePhase } from "./runtime/mergePhase.js"
import { runMutationPhase } from "./runtime/mutation.js"
import { DEFAULT_MAX_MERGE_INVOCATIONS, type GEPAEventSink, type GEPAOptions, noGEPAEvents } from "./runtime/options.js"
import { streamGEPAEvents } from "./runtime/stream.js"

const normalizeNonNegativeCount = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Numeric.isFinite, (candidate) => Numeric.max(0, Numeric.floor(candidate))),
    Match.orElse(() => 0)
  )

export type { GEPAEventSink, GEPAOptions }
export { noGEPAEvents }

/**
 * Evolves a module's instruction and emits each lifecycle event in execution order.
 *
 * @remarks
 * The initial program is evaluated before the first event. Each sink effect
 * completes before the next optimizer step. An iteration may attempt a merge,
 * then proposes one mutation, evaluates acceptance, updates the Pareto
 * frontier, and emits `IterationCompleted`.
 *
 * Typed language-model failures during mutation proposal fall back to the
 * current instruction. Module and metric failures remain in the Effect error
 * channel. Schema decode failures inside candidate evaluation become defects.
 * Temporary candidate instructions are restored after each evaluation. At
 * completion, the instruction from the first index in the final Pareto
 * frontier is written to `options.module`; the same module object is returned.
 * GEPA does not reduce the final frontier to a scalar score ranking.
 *
 * @typeParam I - Input fields accepted by the optimized module.
 * @typeParam O - Output fields scored during candidate evaluation.
 * @typeParam ME - Expected failure from the configured metric.
 * @typeParam MR - Services required by the configured metric.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al. (2025)}
 * @since 0.1.0
 * @category constructors
 */
export const gepaWithEvents = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME = never, MR = never>(
  options: GEPAOptions<I, O, ME, MR>,
  emit: GEPAEventSink
) =>
  Effect.gen(function*() {
    const initialParams = yield* Ref.get(options.module.params)
    const initialCandidate = new ProgramCandidate({
      candidateId: "candidate-0",
      parentIds: Arr.empty<string>(),
      predictorInstructions: Arr.make(
        new PredictorInstruction({ predictorName: options.module.name, instruction: initialParams.instructions })
      )
    })
    const initialEvaluation = yield* evaluateCandidate(options, initialCandidate)
    const initialSnapshot = deriveParetoKernelSnapshot(Arr.make(initialEvaluation.scores))
    const stateRef = yield* Ref.make(
      new GEPAState({
        iteration: 0,
        candidates: Arr.make(initialCandidate),
        scoreVectors: Arr.make(initialEvaluation.scores),
        paretoSnapshot: initialSnapshot,
        mergeBudgetRemaining: normalizeNonNegativeCount(
          Option.getOrElse(
            Option.fromNullable(options.maxMergeInvocations),
            () => DEFAULT_MAX_MERGE_INVOCATIONS
          )
        ),
        lastIterationFoundNew: false,
        seed: normalizeDeterministicSeed(Option.getOrElse(Option.fromNullable(options.seed), () => 1))
      })
    )

    yield* Effect.iterate(1, {
      while: (iteration) => iteration <= normalizeNonNegativeCount(options.maxIterations),
      body: (iteration) =>
        Effect.gen(function*() {
          const state = yield* Ref.get(stateRef)
          const mergeSeed = state.seed
          const mutationSeed = nextDeterministicSeed(mergeSeed)

          yield* emit(
            GEPAEvent.IterationStarted({ iteration, frontierSize: state.paretoSnapshot.frontierIndices.length })
          )

          const stateAfterMerge = yield* runMergePhase(options, state, iteration, mergeSeed, emit)
          const mutationResult = yield* runMutationPhase(
            options,
            stateAfterMerge,
            iteration,
            mutationSeed,
            initialCandidate,
            initialParams.instructions,
            emit
          )
          const updatedSnapshot = deriveParetoKernelSnapshot(mutationResult.stateAfterAcceptance.scoreVectors)
          const nextState = new GEPAState({
            ...mutationResult.stateAfterAcceptance,
            iteration,
            paretoSnapshot: updatedSnapshot,
            seed: nextDeterministicSeed(mutationSeed)
          })

          yield* Ref.set(stateRef, nextState)
          yield* emit(
            GEPAEvent.ParetoUpdated({
              iteration,
              frontierIndices: updatedSnapshot.frontierIndices,
              dominatedIndices: updatedSnapshot.dominatedIndices,
              parentWeights: updatedSnapshot.parentWeights
            })
          )
          yield* emit(
            GEPAEvent.IterationCompleted({
              iteration,
              acceptedCandidate: mutationResult.accepted,
              frontierSize: updatedSnapshot.frontierIndices.length
            })
          )

          return iteration + 1
        })
    })

    const finalState = yield* Ref.get(stateRef)
    const bestIndex = Option.getOrElse(Arr.head(finalState.paretoSnapshot.frontierIndices), () => 0)
    const bestCandidate = Option.getOrElse(Arr.get(finalState.candidates, bestIndex), () => initialCandidate)
    const currentParams = yield* Ref.get(options.module.params)

    yield* Ref.set(
      options.module.params,
      withModuleParamsInstructions(
        currentParams,
        Option.getOrElse(instructionForPredictor(bestCandidate, options.module.name), () => currentParams.instructions)
      )
    )

    yield* emit(
      GEPAEvent.OptimizationCompleted({
        iterations: finalState.iteration,
        bestCandidateId: bestCandidate.candidateId,
        frontierSize: finalState.paretoSnapshot.frontierIndices.length
      })
    )

    return options.module
  })

/**
 * Evolves a module while discarding lifecycle events.
 *
 * @returns The supplied module after its instruction is replaced by the first
 * candidate in the final Pareto frontier.
 *
 * @typeParam I - Input fields accepted by the optimized module.
 * @typeParam O - Output fields scored during candidate evaluation.
 * @typeParam ME - Expected failure from the configured metric.
 * @typeParam MR - Services required by the configured metric.
 *
 * @since 0.1.0
 * @category constructors
 */
export const gepa = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME = never, MR = never>(
  options: GEPAOptions<I, O, ME, MR>
) => gepaWithEvents(options, noGEPAEvents)

/**
 * Emits GEPA lifecycle events while stream consumption drives optimization.
 *
 * @remarks
 * The stream completes after `OptimizationCompleted`. The optimized module is
 * retained through the mutation of `options.module` and is not a stream
 * element. Module and metric failures fail the stream.
 *
 * @typeParam I - Input fields accepted by the optimized module.
 * @typeParam O - Output fields scored during candidate evaluation.
 * @typeParam ME - Expected failure from the configured metric.
 * @typeParam MR - Services required by the configured metric.
 *
 * @since 0.1.0
 * @category constructors
 */
export const gepaStream = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME = never, MR = never>(
  options: GEPAOptions<I, O, ME, MR>
) => streamGEPAEvents((emit) => gepaWithEvents(options, emit))

export * from "./events.js"
export * from "./progress.js"
