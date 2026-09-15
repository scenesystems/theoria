/**
 * GEPA mutation phase — reflective instruction proposal and two-gate
 * acceptance.
 *
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Inspectable,
  Number as Num,
  Option,
  Schema,
  String as Str
} from "effect"

import { extractInstruction, generateText } from "../../../Module/textGeneration.js"
import { evaluateMutationAcceptance } from "../accept.js"
import { GEPAEvent } from "../events.js"
import { GEPAState, PredictorInstruction, ProgramCandidate } from "../model.js"
import { buildReflectiveDataset, buildReflectivePrompt, selectPredictorRoundRobin } from "../reflect.js"

import { evaluateCandidate } from "./evaluate.js"
import { chooseParentIndex, instructionForPredictor } from "./helpers.js"
import type { GEPAEventSink, GEPAOptions } from "./options.js"

/**
 * Result of one mutation iteration — updated state and whether the mutation
 * was accepted.
 *
 * @since 0.1.0
 * @category models
 */
export class MutationPhaseResult extends Schema.Class<MutationPhaseResult>("GEPAMutationPhaseResult")({
  stateAfterAcceptance: GEPAState,
  accepted: Schema.Boolean
}) {}

const buildMutationCandidate = (
  parentCandidate: ProgramCandidate,
  predictorName: string,
  mutatedInstruction: string,
  iteration: number
): ProgramCandidate => {
  const mutatedCandidate = new ProgramCandidate({
    candidateId: Str.concat("mut-", Inspectable.toStringUnknown(iteration)),
    parentIds: Arr.make(parentCandidate.candidateId),
    predictorInstructions: Arr.map(parentCandidate.predictorInstructions, (entry) =>
      new PredictorInstruction({
        predictorName: entry.predictorName,
        instruction: Bool.match(Str.Equivalence(entry.predictorName, predictorName), {
          onFalse: () => entry.instruction,
          onTrue: () => mutatedInstruction
        })
      }))
  })

  return Bool.match(
    Arr.some(mutatedCandidate.predictorInstructions, (entry) => Str.Equivalence(entry.predictorName, predictorName)),
    {
      onTrue: () => mutatedCandidate,
      onFalse: () =>
        new ProgramCandidate({
          candidateId: mutatedCandidate.candidateId,
          parentIds: mutatedCandidate.parentIds,
          predictorInstructions: Arr.append(
            mutatedCandidate.predictorInstructions,
            new PredictorInstruction({ predictorName, instruction: mutatedInstruction })
          )
        })
    }
  )
}

/**
 * Execute one mutation iteration: select a parent, build a reflective prompt,
 * propose a mutated instruction via the meta-LLM, evaluate the candidate,
 * and apply the two-gate acceptance check.
 *
 * @since 0.1.0
 * @category combinators
 */
export const runMutationPhase = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: GEPAOptions<I, O, ME, MR, E, R>,
  stateAfterMerge: GEPAState,
  iteration: number,
  mutationSeed: number,
  initialCandidate: ProgramCandidate,
  initialInstruction: string,
  emit: GEPAEventSink
) =>
  Effect.gen(function*() {
    const parentIndex = chooseParentIndex(stateAfterMerge, mutationSeed)
    const parentCandidate = Option.getOrElse(Arr.get(stateAfterMerge.candidates, parentIndex), () => initialCandidate)
    const parentEvaluation = yield* evaluateCandidate(options, parentCandidate)
    const predictorName = Option.getOrElse(
      selectPredictorRoundRobin(
        Arr.map(parentCandidate.predictorInstructions, (entry) => entry.predictorName),
        Num.decrement(iteration)
      ),
      () => options.module.name
    )
    const currentInstruction = Option.getOrElse(instructionForPredictor(parentCandidate, predictorName), () =>
      initialInstruction)
    const reflectivePrompt = buildReflectivePrompt({
      predictorName,
      currentInstruction,
      examples: buildReflectiveDataset(parentEvaluation.samples)
    })
    const mutatedInstruction = yield* Effect.map(
      generateText(reflectivePrompt),
      (response) =>
        extractInstruction(response, currentInstruction)
    )
    const mutatedCandidate = buildMutationCandidate(parentCandidate, predictorName, mutatedInstruction, iteration)

    yield* emit(
      GEPAEvent.MutationProposed({
        iteration,
        parentId: parentCandidate.candidateId,
        mutatedCandidateId: mutatedCandidate.candidateId,
        predictorName,
        instruction: mutatedInstruction
      })
    )

    const mutatedEvaluation = yield* evaluateCandidate(options, mutatedCandidate)
    const subsampleSize = Numeric.min(
      Numeric.min(3, Arr.length(parentEvaluation.scores)),
      Arr.length(mutatedEvaluation.scores)
    )
    const acceptance = yield* evaluateMutationAcceptance({
      previousSubsampleScores: Arr.take(parentEvaluation.scores, subsampleSize),
      mutatedSubsampleScores: Arr.take(mutatedEvaluation.scores, subsampleSize),
      evaluateFullValset: Effect.succeed(mutatedEvaluation.scores)
    })
    const accepted = Bool.match(acceptance.gate1Passed, {
      onFalse: () => false,
      onTrue: () => Option.isSome(acceptance.fullValsetScores)
    })
    const stateAfterAcceptance = new GEPAState({
      ...stateAfterMerge,
      candidates: Bool.match(accepted, {
        onFalse: () => stateAfterMerge.candidates,
        onTrue: () => Arr.append(stateAfterMerge.candidates, mutatedCandidate)
      }),
      scoreVectors: Bool.match(accepted, {
        onFalse: () => stateAfterMerge.scoreVectors,
        onTrue: () =>
          Arr.append(
            stateAfterMerge.scoreVectors,
            Option.getOrElse(acceptance.fullValsetScores, () => mutatedEvaluation.scores)
          )
      }),
      lastIterationFoundNew: accepted
    })

    yield* emit(
      GEPAEvent.AcceptanceEvaluated({
        iteration,
        accepted,
        gate1Passed: acceptance.gate1Passed,
        fullValsetEvaluated: acceptance.fullValsetEvaluated,
        previousSubsampleSum: acceptance.previousSubsampleSum,
        mutatedSubsampleSum: acceptance.mutatedSubsampleSum
      })
    )

    return new MutationPhaseResult({
      stateAfterAcceptance,
      accepted
    })
  })
