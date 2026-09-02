/**
 * Score-based selection over repeated module calls.
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
 * A forward call runs and scores every rollout sequentially. Ties favor the
 * earlier rollout. `N` is rounded down; values below one and non-finite values
 * produce one candidate. The threshold affects selection after all rollouts
 * finish and does not stop execution early.
 *
 * @see {@link bestOfN} for construction.
 * @see {@link RewardFn} for the scoring callback contract.
 *
 * @typeParam I - Input fields accepted by the inner module.
 * @typeParam O - Output fields returned by the inner module.
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
  /** Requested rollout count, rounded down and normalized to at least one. */
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
 * The inner module and reward callback run sequentially. Each run receives its
 * zero-based rollout identity through `RolloutRef`, so cache keys can
 * distinguish candidates. `N` is rounded down; values below one and non-finite
 * values produce one rollout.
 * The greatest score wins; equal scores preserve the earlier rollout. With a
 * threshold, the greatest passing candidate wins, falling back to the greatest
 * candidate overall when none pass.
 * The wrapper owns a separate parameter Ref, but execution reads the inner
 * module's parameters. Inner-module failures retain their original failure
 * channel. Defects from either callback remain defects.
 *
 * @typeParam I - Inner module input fields.
 * @typeParam O - Inner module output fields.
 * @param options - Inner module, rollout count, reward callback, identity, and optional threshold.
 * @returns A wrapper with independent parameters and the inner module's signature.
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
   * Scores one output in the context of the input that produced it.
   *
   * The callback may perform Effect operations that require no service and
   * have no typed failure. Defects and interruption retain normal Effect
   * behavior. `bestOfN` uses the score; `refine` also uses the feedback.
   *
   * @see {@link MetricResult} for the score and optional feedback.
   * @see {@link bestOfN} for the primary consumer.
   *
   * @since 0.1.0
   * @category models
   */
  type RewardFn
} from "./runtime.js"
