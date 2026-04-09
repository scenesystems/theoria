/**
 * Best-of-N composition wrapper — runs a module N times with distinct
 * rollout identities and returns the highest-scoring candidate.
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"
import { Effect, HashMap, Option, Ref } from "effect"
import type { ModuleId } from "../../contracts/ModuleId.js"
import type { ModuleNode } from "../../contracts/ModuleNode.js"
import { ModuleParams } from "../../contracts/ModuleParams.js"
import { Module } from "../model.js"
import { BestOfNRuntime, type RewardFn } from "./runtime.js"

/**
 * Configuration for a best-of-N composition wrapper.
 *
 * @see {@link bestOfN} — constructor that consumes this options type
 * @see {@link RewardFn} — scoring function type used by `reward`
 *
 * @since 0.1.0
 * @category models
 */
export type BestOfNOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = Readonly<{
  readonly name: string
  readonly module: Module<I, O>
  readonly N: number
  readonly reward: RewardFn<I, O>
  readonly threshold?: number
}>

/**
 * Create a best-of-N module that runs the inner module N times — each
 * with a distinct `RolloutRef` value — scores every candidate with the
 * supplied reward function, and returns the highest-scoring output.
 * When `threshold` is provided, candidates scoring below it are filtered
 * out; if none pass, the best overall candidate is returned.
 *
 * @example
 * ```ts
 * import { Module, Signature } from "effect-dsp"
 * import { Effect, Schema } from "effect"
 * import { MetricResult } from "effect-dsp/contracts"
 *
 * const program = Effect.gen(function*() {
 *   const sig = yield* Signature.make("Classify sentiment", { text: Schema.String }, { label: Schema.String })
 *   const inner = yield* Module.predict("classify", sig)
 *   const best = yield* Module.bestOfN({
 *     name: "classify-best-of-3",
 *     module: inner,
 *     N: 3,
 *     reward: (_input, output) =>
 *       Effect.succeed(new MetricResult({ score: output.label.length > 0 ? 1 : 0 })),
 *     threshold: 0.8
 *   })
 * })
 * ```
 *
 * @see {@link Module}
 * @see {@link RewardFn}
 * @see {@link BestOfNOptions}
 *
 * @since 0.1.0
 * @category constructors
 */
export const bestOfN = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  options: BestOfNOptions<I, O>
): Effect.Effect<Module<I, O>> =>
  Effect.gen(function*() {
    const paramsRef = yield* Ref.make(
      ModuleParams.make({
        instructions: options.module.signature.instructions,
        demos: []
      })
    )

    const forwardOptions = Option.match(Option.fromNullable(options.threshold), {
      onSome: (threshold) => ({
        moduleName: options.name,
        signature: options.module.signature,
        innerModule: options.module,
        N: options.N,
        reward: options.reward,
        threshold
      }),
      onNone: () => ({
        moduleName: options.name,
        signature: options.module.signature,
        innerModule: options.module,
        N: options.N,
        reward: options.reward
      })
    })

    return new Module({
      name: options.name,
      signature: options.module.signature,
      params: paramsRef,
      subModules: HashMap.empty<ModuleId, ModuleNode>(),
      forward: BestOfNRuntime.forward(forwardOptions)
    })
  })

export {
  /**
   * Scoring function that evaluates a single module output given the
   * original input. Returns a {@link MetricResult} with score and
   * optional feedback. Must be pure (no additional error or requirement
   * channels).
   *
   * @see {@link MetricResult} — the score + optional feedback returned
   * @see {@link bestOfN} — primary consumer of this type
   *
   * @since 0.1.0
   * @category models
   */
  type RewardFn
} from "./runtime.js"
