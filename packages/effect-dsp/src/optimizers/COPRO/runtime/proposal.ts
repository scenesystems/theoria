/**
 * COPRO instruction proposal helpers.
 *
 * @since 0.2.0
 * @internal
 */
import { Effect, Option, Ref, Schema } from "effect"
import { ModuleParams } from "../../../contracts/ModuleParams.js"
import * as Module from "../../../Module/index.js"
import * as Signature from "../../../Signature/index.js"

const proposalTemperature = (temperature: Option.Option<number>) =>
  Option.match(temperature, {
    onNone: () => ({}),
    onSome: (value) => ({ temperature: value })
  })

const COPROProposalModule = {
  allocate: (name: string, description: string, temperature: Option.Option<number>) =>
    Effect.gen(function*() {
      const signature = yield* Signature.make(
        description,
        {
          predictorName: Signature.describe(Schema.String, "The predictor currently being optimized"),
          currentInstruction: Signature.describe(
            Schema.String,
            "The current instruction before proposing a new candidate"
          ),
          step: Signature.describe(Schema.Number, "The zero-based COPRO step index"),
          candidateIndex: Signature.describe(
            Schema.Number,
            "The zero-based candidate slot within the current step"
          ),
          attempts: Signature.describe(Schema.String, "Prior scored instruction attempts for this predictor")
        },
        {
          instruction: Signature.describe(Schema.String, "One improved instruction candidate")
        }
      )
      const module = yield* Module.predict(name, signature)

      yield* Ref.set(
        module.params,
        ModuleParams.make({
          instructions: description,
          demos: [],
          outputStrategy: "structured",
          ...proposalTemperature(temperature)
        })
      )

      return module
    })
}

const proposeInstruction = (options: {
  readonly moduleName: string
  readonly description: string
  readonly predictorName: string
  readonly currentInstruction: string
  readonly attempts: string
  readonly step: number
  readonly candidateIndex: number
  readonly temperature: Option.Option<number>
}) =>
  Effect.gen(function*() {
    const proposalModule = yield* COPROProposalModule.allocate(
      `${options.moduleName}-${options.predictorName}-${options.step}-${options.candidateIndex}`,
      options.description,
      options.temperature
    )
    const result = yield* Module.withDiscoveryScope(
      proposalModule.forward({
        predictorName: options.predictorName,
        currentInstruction: options.currentInstruction,
        attempts: options.attempts,
        step: options.step,
        candidateIndex: options.candidateIndex
      })
    )

    return result.instruction.trim()
  })

/**
 * Propose one seed-phase instruction candidate.
 *
 * @since 0.2.0
 * @category constructors
 */
export const proposeSeedInstruction = (options: {
  readonly predictorName: string
  readonly currentInstruction: string
  readonly step: number
  readonly candidateIndex: number
  readonly temperature: Option.Option<number>
}) =>
  proposeInstruction({
    moduleName: "copro-seed-instruction",
    description: "COPRO seed instruction proposer. Generate one alternative instruction candidate.",
    predictorName: options.predictorName,
    currentInstruction: options.currentInstruction,
    attempts: "",
    step: options.step,
    candidateIndex: options.candidateIndex,
    temperature: options.temperature
  })

/**
 * Propose one refinement-phase instruction candidate from scored attempt
 * history.
 *
 * @since 0.2.0
 * @category constructors
 */
export const proposeRefinedInstruction = (options: {
  readonly predictorName: string
  readonly currentInstruction: string
  readonly attempts: string
  readonly step: number
  readonly candidateIndex: number
  readonly temperature: Option.Option<number>
}) =>
  proposeInstruction({
    moduleName: "copro-refine-instruction",
    description: "COPRO refinement instruction proposer. Use the scored attempt history to improve the instruction.",
    predictorName: options.predictorName,
    currentInstruction: options.currentInstruction,
    attempts: options.attempts,
    step: options.step,
    candidateIndex: options.candidateIndex,
    temperature: options.temperature
  })
