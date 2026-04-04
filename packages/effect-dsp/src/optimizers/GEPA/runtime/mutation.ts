/**
 * GEPA mutation phase — reflective instruction proposal and two-gate
 * acceptance.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option } from "effect"
import type { Schema } from "effect"

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
export type MutationPhaseResult = Readonly<{
  readonly stateAfterAcceptance: GEPAState
  readonly accepted: boolean
}>

const buildMutationCandidate = (
  parentCandidate: ProgramCandidate,
  predictorName: string,
  mutatedInstruction: string,
  iteration: number
): ProgramCandidate => {
  const mutatedCandidate = new ProgramCandidate({
    candidateId: `mut-${iteration}`,
    parentIds: Arr.make(parentCandidate.candidateId),
    predictorInstructions: Arr.map(parentCandidate.predictorInstructions, (entry) =>
      new PredictorInstruction({
        predictorName: entry.predictorName,
        instruction: entry.predictorName === predictorName
          ? mutatedInstruction
          : entry.instruction
      }))
  })

  return Arr.some(mutatedCandidate.predictorInstructions, (entry) => entry.predictorName === predictorName)
    ? mutatedCandidate
    : new ProgramCandidate({
      candidateId: mutatedCandidate.candidateId,
      parentIds: mutatedCandidate.parentIds,
      predictorInstructions: Arr.append(
        mutatedCandidate.predictorInstructions,
        new PredictorInstruction({ predictorName, instruction: mutatedInstruction })
      )
    })
}

/**
 * Execute one mutation iteration: select a parent, build a reflective prompt,
 * propose a mutated instruction via the meta-LLM, evaluate the candidate,
 * and apply the two-gate acceptance check.
 *
 * @since 0.1.0
 * @category combinators
 */
export const runMutationPhase = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR>(
  options: GEPAOptions<I, O, ME, MR>,
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
        iteration - 1
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
    const mutatedInstruction = yield* generateText(reflectivePrompt).pipe(
      Effect.map((response) =>
        extractInstruction(response, currentInstruction)
      ),
      Effect.orElseSucceed(() => currentInstruction)
    )
    const mutationWithFallback = buildMutationCandidate(parentCandidate, predictorName, mutatedInstruction, iteration)

    yield* emit(
      GEPAEvent.MutationProposed({
        iteration,
        parentId: parentCandidate.candidateId,
        mutatedCandidateId: mutationWithFallback.candidateId,
        predictorName,
        instruction: mutatedInstruction
      })
    )

    const mutatedEvaluation = yield* evaluateCandidate(options, mutationWithFallback)
    const subsampleSize = Math.min(3, parentEvaluation.scores.length, mutatedEvaluation.scores.length)
    const acceptance = yield* evaluateMutationAcceptance({
      previousSubsampleScores: Arr.take(parentEvaluation.scores, subsampleSize),
      mutatedSubsampleScores: Arr.take(mutatedEvaluation.scores, subsampleSize),
      evaluateFullValset: Effect.succeed(mutatedEvaluation.scores)
    })
    const accepted = acceptance.gate1Passed && Option.isSome(acceptance.fullValsetScores)
    const stateAfterAcceptance = new GEPAState({
      ...stateAfterMerge,
      candidates: accepted
        ? Arr.append(stateAfterMerge.candidates, mutationWithFallback)
        : stateAfterMerge.candidates,
      scoreVectors: accepted
        ? Arr.append(
          stateAfterMerge.scoreVectors,
          Option.getOrElse(acceptance.fullValsetScores, () => mutatedEvaluation.scores)
        )
        : stateAfterMerge.scoreVectors,
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

    return {
      stateAfterAcceptance,
      accepted
    }
  })
