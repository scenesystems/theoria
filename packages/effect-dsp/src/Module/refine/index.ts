/**
 * Refinement composition wrapper — iteratively improves module output
 * by feeding reward feedback back into the prompt.
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"
import { Effect, HashMap, Ref } from "effect"
import type { ModuleId } from "../../contracts/ModuleId.js"
import type { ModuleNode } from "../../contracts/ModuleNode.js"
import { ModuleParams } from "../../contracts/ModuleParams.js"
import type { RewardFn } from "../bestOfN/runtime.js"
import { Module } from "../model.js"
import { RefineRuntime } from "./runtime.js"

/**
 * Configuration for a refinement composition wrapper.
 *
 * @see {@link refine} — constructor that consumes this options type
 * @see {@link RewardFn} — scoring function type used by `reward`
 *
 * @since 0.1.0
 * @category models
 */
export type RefineOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = Readonly<{
  readonly name: string
  readonly module: Module<I, O>
  readonly N: number
  readonly reward: RewardFn<I, O>
  readonly threshold: number
}>

/**
 * Create a refinement module that iteratively runs the inner module,
 * scores the output, and — when the score falls below `threshold` —
 * appends the reward feedback to the module's instructions before
 * retrying. Stops early when a candidate meets the threshold or
 * after `N` attempts. Base params are restored on exit to prevent
 * cross-call drift.
 *
 * @example
 * ```ts
 * import { Module, Signature } from "effect-dsp"
 * import { Effect, Schema } from "effect"
 * import { MetricResult } from "effect-dsp/contracts"
 *
 * const program = Effect.gen(function*() {
 *   const sig = yield* Signature.make("Summarize text", { text: Schema.String }, { summary: Schema.String })
 *   const inner = yield* Module.predict("summarize", sig)
 *   const refined = yield* Module.refine({
 *     name: "summarize-refined",
 *     module: inner,
 *     N: 3,
 *     reward: (_input, output) =>
 *       Effect.succeed(new MetricResult({
 *         score: output.summary.length > 10 ? 0.9 : 0.3,
 *         feedback: "Summary should be more detailed"
 *       })),
 *     threshold: 0.8
 *   })
 * })
 * ```
 *
 * @see {@link Module}
 * @see {@link RewardFn}
 * @see {@link RefineOptions}
 *
 * @since 0.1.0
 * @category constructors
 */
export const refine = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  options: RefineOptions<I, O>
): Effect.Effect<Module<I, O>> =>
  Effect.gen(function*() {
    const paramsRef = yield* Ref.make(
      ModuleParams.make({
        instructions: options.module.signature.instructions,
        demos: []
      })
    )

    return new Module({
      name: options.name,
      signature: options.module.signature,
      params: paramsRef,
      subModules: HashMap.empty<ModuleId, ModuleNode>(),
      forward: RefineRuntime.forward({
        moduleName: options.name,
        signature: options.module.signature,
        innerModule: options.module,
        N: options.N,
        reward: options.reward,
        threshold: options.threshold
      })
    })
  })
