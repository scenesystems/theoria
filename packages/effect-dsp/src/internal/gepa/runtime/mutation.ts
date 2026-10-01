/**
 * GEPA mutation phase — reflective instruction proposal and two-gate
 * acceptance.
 *
 * @since 0.1.0
 */
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

import { events, type EventSink, type Options as GEPAOptions } from "../../../GEPA.js"
import { extractInstruction, generateText } from "../../module/textGeneration.js"
import { evaluateMutationAcceptance } from "../accept.js"
import { GEPAState, PredictorInstruction, ProgramCandidate } from "../model.js"
import {
  buildReflectiveDataset,
  buildReflectivePrompt,
  selectPredictorRoundRobin,
  selectReflectiveSamples
} from "../reflect.js"

import { chooseParentIndex, instructionForPredictor } from "./candidateSelection.js"
import { CandidateEvaluationWindow, evaluateCandidate } from "./evaluate.js"

/**
 * Result of one mutation iteration — updated state and whether the mutation
 * was accepted.
 *
 * @since 0.1.0
 * @category models
 */
export class MutationPhaseResult extends Schema.Class<MutationPhaseResult>(
  "@scenesystems/effect-dsp/internal/gepa/runtime/mutation/MutationPhaseResult"
)({
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
export const runMutationPhase = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R, EE, ER>(
  options: GEPAOptions<I, O, ME, MR, E, R>,
  stateAfterMerge: GEPAState,
  iteration: number,
  mutationSeed: number,
  initialCandidate: ProgramCandidate,
  emit: EventSink<EE, ER>
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
    const currentInstruction = Option.getOrElse(instructionForPredictor(parentCandidate, predictorName), () => "")
    const reflectivePrompt = buildReflectivePrompt({
      predictorName,
      currentInstruction,
      examples: buildReflectiveDataset(selectReflectiveSamples(parentEvaluation.samples, predictorName))
    })
    const mutatedInstruction = yield* Effect.map(
      generateText(reflectivePrompt),
      (response) => extractInstruction(response, currentInstruction)
    )
    const mutatedCandidate = buildMutationCandidate(parentCandidate, predictorName, mutatedInstruction, iteration)

    yield* emit(
      events.MutationProposed({
        iteration,
        parentId: parentCandidate.candidateId,
        mutatedCandidateId: mutatedCandidate.candidateId,
        predictorName,
        instruction: mutatedInstruction
      })
    )

    const subsampleSize = Num.min(3, Arr.length(parentEvaluation.scores))
    const mutatedSubsampleEvaluation = yield* evaluateCandidate(
      options,
      mutatedCandidate,
      new CandidateEvaluationWindow({
        startIndex: 0,
        rowCount: Option.some(subsampleSize)
      })
    )
    const acceptance = yield* evaluateMutationAcceptance({
      previousSubsampleScores: Arr.take(parentEvaluation.scores, subsampleSize),
      mutatedSubsampleScores: mutatedSubsampleEvaluation.scores,
      evaluateFullValset: evaluateCandidate(
        options,
        mutatedCandidate,
        new CandidateEvaluationWindow({
          startIndex: subsampleSize,
          rowCount: Option.none()
        })
      ).pipe(
        Effect.map((remainingEvaluation) =>
          Arr.appendAll(mutatedSubsampleEvaluation.scores, remainingEvaluation.scores)
        )
      )
    })
    const accepted = Bool.match(acceptance.gate1Passed, {
      onFalse: () => false,
      onTrue: () => Option.isSome(acceptance.fullValsetScores)
    })
    const stateAfterAcceptance = new GEPAState({
      iteration: stateAfterMerge.iteration,
      candidates: Bool.match(accepted, {
        onFalse: () => stateAfterMerge.candidates,
        onTrue: () => Arr.append(stateAfterMerge.candidates, mutatedCandidate)
      }),
      scoreVectors: Bool.match(accepted, {
        onFalse: () => stateAfterMerge.scoreVectors,
        onTrue: () =>
          Arr.append(
            stateAfterMerge.scoreVectors,
            Option.getOrElse(acceptance.fullValsetScores, () => mutatedSubsampleEvaluation.scores)
          )
      }),
      paretoSnapshot: stateAfterMerge.paretoSnapshot,
      mergeBudgetRemaining: stateAfterMerge.mergeBudgetRemaining,
      lastIterationFoundNew: accepted,
      seed: stateAfterMerge.seed
    })

    yield* emit(
      events.AcceptanceEvaluated({
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
