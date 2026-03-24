/**
 * GEPA three-way instruction crossover — merges predictor instructions using
 * common-ancestor diffing.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.0.0
 */
import { Array as Arr, Match, Option } from "effect"
import { PredictorInstruction, type ProgramCandidate } from "../model.js"

const instructionForPredictor = (
  instructions: ReadonlyArray<PredictorInstruction>,
  predictorName: string
): Option.Option<string> =>
  Arr.findFirst(instructions, (entry) => entry.predictorName === predictorName).pipe(
    Option.map((entry) => entry.instruction)
  )

const collectPredictorNames = (
  groups: ReadonlyArray<ReadonlyArray<PredictorInstruction>>
): ReadonlyArray<string> =>
  Arr.reduce(
    groups,
    Arr.empty<string>(),
    (names, group) =>
      Arr.reduce(
        group,
        names,
        (acc, entry) =>
          Match.value(Arr.some(acc, (name) => name === entry.predictorName)).pipe(
            Match.when(true, () => acc),
            Match.orElse(() => Arr.append(acc, entry.predictorName))
          )
      )
  )

const chooseMergedInstruction = (options: {
  readonly ancestorInstruction: Option.Option<string>
  readonly parentAInstruction: Option.Option<string>
  readonly parentBInstruction: Option.Option<string>
  readonly parentAScore: number
  readonly parentBScore: number
}): string => {
  const ancestorInstruction = Option.getOrElse(options.ancestorInstruction, () => "")
  const parentAInstruction = Option.getOrElse(options.parentAInstruction, () => ancestorInstruction)
  const parentBInstruction = Option.getOrElse(options.parentBInstruction, () => ancestorInstruction)

  return Match.value({
    parentAInstruction,
    parentBInstruction,
    parentAChanged: parentAInstruction !== ancestorInstruction,
    parentBChanged: parentBInstruction !== ancestorInstruction
  }).pipe(
    Match.when(
      ({ parentAInstruction, parentBInstruction }) => parentAInstruction === parentBInstruction,
      ({ parentAInstruction }) => parentAInstruction
    ),
    Match.when(
      ({ parentAChanged, parentBChanged }) => parentAChanged && !parentBChanged,
      ({ parentAInstruction }) => parentAInstruction
    ),
    Match.when(
      ({ parentAChanged, parentBChanged }) => !parentAChanged && parentBChanged,
      ({ parentBInstruction }) => parentBInstruction
    ),
    Match.orElse((state) =>
      Match.value(options.parentAScore >= options.parentBScore).pipe(
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
 * @since 0.0.0
 * @category combinators
 */
export const mergePredictorInstructions = (options: {
  readonly ancestor: ProgramCandidate
  readonly parentA: ProgramCandidate
  readonly parentB: ProgramCandidate
  readonly parentAScore: number
  readonly parentBScore: number
}): ReadonlyArray<PredictorInstruction> =>
  Arr.map(
    collectPredictorNames([
      options.ancestor.predictorInstructions,
      options.parentA.predictorInstructions,
      options.parentB.predictorInstructions
    ]),
    (predictorName) =>
      new PredictorInstruction({
        predictorName,
        instruction: chooseMergedInstruction({
          ancestorInstruction: instructionForPredictor(options.ancestor.predictorInstructions, predictorName),
          parentAInstruction: instructionForPredictor(options.parentA.predictorInstructions, predictorName),
          parentBInstruction: instructionForPredictor(options.parentB.predictorInstructions, predictorName),
          parentAScore: options.parentAScore,
          parentBScore: options.parentBScore
        })
      })
  )
