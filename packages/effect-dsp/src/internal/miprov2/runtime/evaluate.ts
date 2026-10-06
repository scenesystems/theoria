/** Immutable instruction/demo overlays for MIPROv2 search. @internal */
import { Array as Arr, Data, Effect, Option, Record, Tuple } from "effect"
import { AllTrialsFailed } from "../../../DspError.js"
import { withDemosAndInstructions } from "../../../ModuleParameters.js"
import { demoDimensionName, instructionDimensionName, type Phase3Config, type PredictorBinding } from "./model.js"
import { configIndex } from "./searchSpace.js"

/** @internal */
export class ParametersForConfigOptions extends Data.Class<{
  readonly config: Phase3Config
  readonly bindings: Iterable<PredictorBinding>
  readonly trialBudget: number
}> {}

/** Resolves candidate indexes without changing caller parameters. @internal */
export const parametersForConfig = (options: ParametersForConfigOptions) =>
  Effect.forEach(options.bindings, (binding) =>
    Effect.gen(function*() {
      const instructionIndex = yield* configIndex(options.config, instructionDimensionName(binding.index))
      const instruction = yield* Effect.fromOption(Arr.get(binding.instructions.candidates, instructionIndex), () =>
        new AllTrialsFailed({
          message: `Missing instruction candidate index ${instructionIndex} for predictor '${binding.predictorName}'`,
          trialCount: options.trialBudget
        }))
      const parameters = yield* Option.match(binding.demos, {
        onNone: () =>
          Effect.succeed(binding.originalParameters),
        onSome: (demos) =>
          Effect.gen(function*() {
            const index = yield* configIndex(options.config, demoDimensionName(binding.index))
            const demo = yield* Effect.fromOption(Arr.get(demos.candidates, index), () =>
              new AllTrialsFailed({
                message: `Missing demo candidate index ${index} for predictor '${binding.predictorName}'`,
                trialCount: options.trialBudget
              }))
            return demo.parameters
          })
      })
      return Tuple.make(
        binding.predictorId,
        withDemosAndInstructions(parameters, parameters.demos, instruction.instruction)
      )
    })).pipe(Effect.map(Record.fromEntries))
