/**
 * GEPA optimizer — evolutionary prompt adaptation via Pareto-weighted parent
 * selection, common-ancestor merge, and reflective mutation.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.0.0
 */
import { Array as Arr, Effect, Option, Ref } from "effect"
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

export type { GEPAEventSink, GEPAOptions }
export { noGEPAEvents }

/**
 * Run GEPA with an explicit event sink for real-time progress streaming.
 * Maintains a population of candidate programs and evolves them via
 * merge/crossover and reflective mutation across `maxIterations` generations.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al. (2025)}
 * @since 0.0.0
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
        mergeBudgetRemaining: Option.getOrElse(Option.fromNullable(options.maxMergeInvocations), () =>
          DEFAULT_MAX_MERGE_INVOCATIONS),
        lastIterationFoundNew: false,
        seed: normalizeDeterministicSeed(Option.getOrElse(Option.fromNullable(options.seed), () =>
          1))
      })
    )

    yield* Effect.iterate(1, {
      while: (iteration) => iteration <= Math.max(0, Math.trunc(options.maxIterations)),
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
 * Run GEPA and return the module with optimized instructions. The best
 * candidate is selected from the Pareto frontier after all iterations complete.
 *
 * @since 0.0.0
 * @category constructors
 */
export const gepa = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME = never, MR = never>(
  options: GEPAOptions<I, O, ME, MR>
) => gepaWithEvents(options, noGEPAEvents)

/**
 * Run GEPA and project all lifecycle events as an Effect Stream.
 *
 * @since 0.0.0
 * @category constructors
 */
export const gepaStream = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME = never, MR = never>(
  options: GEPAOptions<I, O, ME, MR>
) => streamGEPAEvents((emit) => gepaWithEvents(options, emit))

export * from "./events.js"
export * from "./progress.js"
