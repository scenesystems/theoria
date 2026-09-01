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
import { makeDefaultModuleParams } from "../../contracts/ModuleParams.js"
import { Module } from "../model.js"
import { makeBestOfNForward, type RewardFn } from "./runtime.js"

/**
 * Controls repeated candidate generation and score-based selection.
 *
 * @remarks
 * A forward call runs and scores every rollout sequentially, then returns the
 * highest score. Ties favor the earlier rollout. `N` values below one still
 * produce one candidate; no option enables parallel rollout execution.
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
  /** Identity of the composed module and its forward span. */
  readonly name: string
  /** Module invoked once per rollout; its signature becomes the wrapper signature. */
  readonly module: Module<I, O>
  /** Requested rollout count, normalized to at least one. */
  readonly N: number
  /** Scores each output immediately after its rollout completes. */
  readonly reward: RewardFn<I, O>
  /**
   * Passing score used during selection. If no candidate reaches it, the best
   * candidate overall is still returned. Omission selects by score alone.
   */
  readonly threshold?: number
}>

/**
 * Creates a wrapper that selects the best of repeated inner-module runs.
 *
 * @remarks
 * The inner module and reward callback run sequentially `max(1, N)` times. Each run receives its zero-based rollout
 * identity through `RolloutRef`, so cache keys can distinguish candidates.
 * The greatest score wins; equal scores preserve the earlier rollout. With a
 * threshold, the greatest passing candidate wins, falling back to the greatest
 * candidate overall when none pass.
 * The wrapper owns a separate parameter Ref, but execution reads the inner
 * module's parameters. Inner-module and reward defects propagate through the
 * module's fixed failure/environment contract.
 *
 * @typeParam I - Inner module input fields.
 * @typeParam O - Inner module output fields.
 * @param options - Inner module, rollout count, reward callback, identity, and optional threshold.
 * @returns An Effect allocating the wrapper module.
 *
 * @example
 * ```ts
 * import { Module, Signature } from "@scenesystems/effect-dsp"
 * import { Effect, Schema } from "effect"
 * import { MetricResult } from "@scenesystems/effect-dsp/contracts"
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
      makeDefaultModuleParams(options.module.signature.instructions)
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
      forward: makeBestOfNForward(forwardOptions)
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
