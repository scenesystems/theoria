/**
 * GEPA three-way instruction crossover — merges predictor instructions using
 * common-ancestor diffing.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Match, Number as Num, Option, Schema, String as Str } from "effect"
import { PredictorInstruction, type PredictorInstructions } from "../model.js"
import type { MergePredictorInstructionsOptions } from "./model.js"

const isNonNaN = Schema.is(Schema.NonNaN)

const instructionForPredictor = (
  instructions: PredictorInstructions,
  predictorName: string
): Option.Option<string> =>
  Arr.findFirst(instructions, (entry) => Str.Equivalence(entry.predictorName, predictorName)).pipe(
    Option.map((entry) => entry.instruction)
  )

const collectPredictorNames = (groups: Iterable<PredictorInstructions>) =>
  Arr.dedupe(Arr.flatMap(Arr.fromIterable(groups), (group) => Arr.map(group, (entry) => entry.predictorName)))

const chooseMergedInstruction = (
  ancestorInstructionOption: Option.Option<string>,
  parentAInstructionOption: Option.Option<string>,
  parentBInstructionOption: Option.Option<string>,
  parentAScore: number,
  parentBScore: number
): string => {
  const ancestorInstruction = Option.getOrElse(ancestorInstructionOption, () => "")
  const parentAInstruction = Option.getOrElse(parentAInstructionOption, () => ancestorInstruction)
  const parentBInstruction = Option.getOrElse(parentBInstructionOption, () => ancestorInstruction)

  return Match.value({
    parentAInstruction,
    parentBInstruction,
    parentAChanged: Bool.not(Str.Equivalence(parentAInstruction, ancestorInstruction)),
    parentBChanged: Bool.not(Str.Equivalence(parentBInstruction, ancestorInstruction))
  }).pipe(
    Match.when(
      ({ parentAInstruction, parentBInstruction }) => Str.Equivalence(parentAInstruction, parentBInstruction),
      ({ parentAInstruction }) => parentAInstruction
    ),
    Match.when(
      ({ parentAChanged, parentBChanged }) => Bool.and(parentAChanged, Bool.not(parentBChanged)),
      ({ parentAInstruction }) => parentAInstruction
    ),
    Match.when(
      ({ parentAChanged, parentBChanged }) => Bool.and(Bool.not(parentAChanged), parentBChanged),
      ({ parentBInstruction }) => parentBInstruction
    ),
    Match.orElse((state) =>
      Match.value(
        Bool.match(Bool.and(isNonNaN(parentAScore), isNonNaN(parentBScore)), {
          onFalse: () => false,
          onTrue: () => Num.greaterThanOrEqualTo(parentAScore, parentBScore)
        })
      ).pipe(
        Match.when(true, () => state.parentAInstruction),
        Match.orElse(() => state.parentBInstruction)
      )
    )
  )
}

/**
 * Merge predictor instructions using DSPy common-ancestor crossover semantics.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al. (2025)}
 * @since 0.1.0
 * @category combinators
 */
export const mergePredictorInstructions = (options: MergePredictorInstructionsOptions): PredictorInstructions =>
  Arr.map(
    collectPredictorNames(Arr.make(
      options.ancestor.predictorInstructions,
      options.parentA.predictorInstructions,
      options.parentB.predictorInstructions
    )),
    (predictorName) =>
      new PredictorInstruction({
        predictorName,
        instruction: chooseMergedInstruction(
          instructionForPredictor(options.ancestor.predictorInstructions, predictorName),
          instructionForPredictor(options.parentA.predictorInstructions, predictorName),
          instructionForPredictor(options.parentB.predictorInstructions, predictorName),
          options.parentAScore,
          options.parentBScore
        )
      })
  )
