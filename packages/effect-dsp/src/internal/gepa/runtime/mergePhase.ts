/**
 * GEPA merge phase orchestration.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Inspectable, Number as Num, Option, String as Str } from "effect"
import type { Schema } from "effect"

import { events, type EventSink, type Options as GEPAOptions } from "../../../GEPA.js"
import { evaluateMergeAcceptance } from "../accept.js"
import { prepareCommonAncestorMerge, recordAcceptedMerge } from "../merge.js"
import { GEPAState, MergeState } from "../model.js"

import {
  buildMergeComparisons,
  chooseParentPairIndices,
  scoreVectorForComparisons,
  shouldAttemptMerge
} from "./candidateSelection.js"
import { evaluateCandidate } from "./evaluate.js"

const mergeCheckedEvent = (
  iteration: number,
  attempted: boolean,
  accepted: boolean,
  mergeBudgetRemaining: number
) =>
  events.MergeChecked({
    iteration,
    attempted,
    accepted,
    mergeBudgetRemaining
  })

/**
 * Execute the GEPA merge/crossover stage for one iteration.
 *
 * @since 0.1.0
 * @category combinators
 */
export const runMergePhase = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R, EE, ER>(
  options: GEPAOptions<I, O, ME, MR, E, R>,
  state: GEPAState,
  iteration: number,
  mergeSeed: number,
  emit: EventSink<EE, ER>
) =>
  Effect.if(shouldAttemptMerge(state), {
    onFalse: () =>
      emit(
        mergeCheckedEvent(iteration, false, false, state.mergeBudgetRemaining)
      ).pipe(Effect.as(state)),
    onTrue: () =>
      Effect.gen(function*() {
        const [parentAIndex, parentBIndex] = chooseParentPairIndices(state, mergeSeed)

        return yield* Option.match(
          Option.product(Arr.get(state.candidates, parentAIndex), Arr.get(state.candidates, parentBIndex)),
          {
            onNone: () =>
              emit(
                mergeCheckedEvent(iteration, false, false, state.mergeBudgetRemaining)
              ).pipe(Effect.as(state)),
            onSome: ([parentA, parentB]) =>
              Effect.gen(function*() {
                const parentAScores = Option.getOrElse(Arr.get(state.scoreVectors, parentAIndex), () =>
                  Arr.empty<number>())
                const parentBScores = Option.getOrElse(Arr.get(state.scoreVectors, parentBIndex), () =>
                  Arr.empty<number>())
                const preparation = prepareCommonAncestorMerge({
                  candidates: state.candidates,
                  parentAId: parentA.candidateId,
                  parentBId: parentB.candidateId,
                  parentAScore: Arr.reduce(parentAScores, 0, Num.sum),
                  parentBScore: Arr.reduce(parentBScores, 0, Num.sum),
                  mergedCandidateId: Str.concat("merge-", Inspectable.toStringUnknown(iteration)),
                  comparisons: buildMergeComparisons(parentAScores, parentBScores),
                  mergeBudgetRemaining: state.mergeBudgetRemaining,
                  seed: mergeSeed
                })

                return yield* Option.match(preparation.candidate, {
                  onNone: () =>
                    emit(
                      mergeCheckedEvent(iteration, true, false, state.mergeBudgetRemaining)
                    ).pipe(Effect.as(state)),
                  onSome: (candidate) =>
                    Effect.gen(function*() {
                      const mergedEvaluation = yield* evaluateCandidate(options, candidate)
                      const mergeAcceptance = evaluateMergeAcceptance({
                        mergedSubsampleScores: scoreVectorForComparisons(
                          mergedEvaluation.scores,
                          preparation.subsample
                        ),
                        parentASubsampleScores: Arr.map(preparation.subsample, (comparison) =>
                          comparison.parentAScore),
                        parentBSubsampleScores: Arr.map(preparation.subsample, (comparison) =>
                          comparison.parentBScore)
                      })

                      return yield* Effect.if(mergeAcceptance.accepted, {
                        onTrue: () =>
                          Effect.gen(function*() {
                            const mergeState = recordAcceptedMerge(
                              new MergeState({
                                candidates: state.candidates,
                                mergeBudgetRemaining: state.mergeBudgetRemaining
                              }),
                              candidate
                            )

                            yield* emit(
                              mergeCheckedEvent(iteration, true, true, mergeState.mergeBudgetRemaining)
                            )

                            return new GEPAState({
                              iteration: state.iteration,
                              candidates: mergeState.candidates,
                              scoreVectors: Arr.append(state.scoreVectors, mergedEvaluation.scores),
                              paretoSnapshot: state.paretoSnapshot,
                              mergeBudgetRemaining: mergeState.mergeBudgetRemaining,
                              lastIterationFoundNew: state.lastIterationFoundNew,
                              seed: state.seed
                            })
                          }),
                        onFalse: () =>
                          emit(
                            mergeCheckedEvent(iteration, true, false, state.mergeBudgetRemaining)
                          ).pipe(Effect.as(state))
                      })
                    })
                })
              })
          }
        )
      })
  })
