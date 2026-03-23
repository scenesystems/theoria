/**
 * GEPA merge phase orchestration.
 *
 * @since 0.0.0
 */
import { Array as Arr, Effect, Option } from "effect"
import type { Schema } from "effect"

import { evaluateMergeAcceptance } from "../accept.js"
import { GEPAEvent } from "../events.js"
import { prepareCommonAncestorMerge, recordAcceptedMerge } from "../merge.js"
import { GEPAState, MergeState } from "../model.js"

import { evaluateCandidate } from "./evaluate.js"
import {
  buildMergeComparisons,
  chooseParentPairIndices,
  scoreVectorForComparisons,
  shouldAttemptMerge
} from "./helpers.js"
import type { GEPAEventSink, GEPAOptions } from "./options.js"

const mergeCheckedEvent = (options: {
  readonly iteration: number
  readonly attempted: boolean
  readonly accepted: boolean
  readonly mergeBudgetRemaining: number
}) =>
  GEPAEvent.MergeChecked({
    iteration: options.iteration,
    attempted: options.attempted,
    accepted: options.accepted,
    mergeBudgetRemaining: options.mergeBudgetRemaining
  })

/**
 * Execute the GEPA merge/crossover stage for one iteration.
 *
 * @since 0.0.0
 * @category combinators
 */
export const runMergePhase = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR>(
  options: GEPAOptions<I, O, ME, MR>,
  state: GEPAState,
  iteration: number,
  mergeSeed: number,
  emit: GEPAEventSink
) =>
  Effect.if(shouldAttemptMerge(state), {
    onFalse: () =>
      emit(
        mergeCheckedEvent({
          iteration,
          attempted: false,
          accepted: false,
          mergeBudgetRemaining: state.mergeBudgetRemaining
        })
      ).pipe(Effect.as(state)),
    onTrue: () =>
      Effect.gen(function*() {
        const [parentAIndex, parentBIndex] = chooseParentPairIndices(state, mergeSeed)

        return yield* Option.match(
          Option.product(Arr.get(state.candidates, parentAIndex), Arr.get(state.candidates, parentBIndex)),
          {
            onNone: () =>
              emit(
                mergeCheckedEvent({
                  iteration,
                  attempted: false,
                  accepted: false,
                  mergeBudgetRemaining: state.mergeBudgetRemaining
                })
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
                  parentAScore: Arr.reduce(parentAScores, 0, (sum, score) =>
                    sum + score),
                  parentBScore: Arr.reduce(parentBScores, 0, (sum, score) =>
                    sum + score),
                  mergedCandidateId: `merge-${iteration}`,
                  comparisons: buildMergeComparisons(parentAScores, parentBScores),
                  mergeBudgetRemaining: state.mergeBudgetRemaining,
                  seed: mergeSeed
                })

                return yield* Option.match(preparation.candidate, {
                  onNone: () =>
                    emit(
                      mergeCheckedEvent({
                        iteration,
                        attempted: true,
                        accepted: false,
                        mergeBudgetRemaining: state.mergeBudgetRemaining
                      })
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
                        parentBSubsampleScores: Arr.map(preparation.subsample, (comparison) => comparison.parentBScore)
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
                              mergeCheckedEvent({
                                iteration,
                                attempted: true,
                                accepted: true,
                                mergeBudgetRemaining: mergeState.mergeBudgetRemaining
                              })
                            )

                            return new GEPAState({
                              ...state,
                              ...mergeState,
                              scoreVectors: Arr.append(state.scoreVectors, mergedEvaluation.scores)
                            })
                          }),
                        onFalse: () =>
                          emit(
                            mergeCheckedEvent({
                              iteration,
                              attempted: true,
                              accepted: false,
                              mergeBudgetRemaining: state.mergeBudgetRemaining
                            })
                          ).pipe(Effect.as(state))
                      })
                    })
                })
              })
          }
        )
      })
  })
