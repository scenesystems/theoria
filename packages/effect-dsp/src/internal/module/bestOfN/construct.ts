/**
 * Score-based selection over repeated module calls.
 *
 * @since 0.1.0
 * @module
 */
import type { Schema } from "effect"
import { Effect, Record, Ref } from "effect"
import type { CompositionError } from "../../../DspError.js"
import { type BestOfNOptions, Module } from "../../../Module.js"
import { make as makeDefaultModuleParameters } from "../../../ModuleParameters.js"
import { buildCompositionGraph } from "../compose/graph.js"
import { ComposeForwardOptions, makeComposeForward } from "../compose/runtime.js"
import { makeBestOfNForward } from "./runtime.js"

/**
 * Creates a wrapper that selects the best of repeated inner-module runs.
 *
 * @remarks
 * The inner module and reward callback run sequentially. Each run receives its
 * zero-based rollout identity through `RolloutRef`, so cache keys can
 * distinguish candidates. `N` rollouts run; the {@link RolloutCount} brand
 * rules out zero or fractional counts before this constructor is reached.
 * The greatest non-`NaN` score wins; equal scores preserve the earlier rollout,
 * and all-`NaN` scores preserve the first rollout. With a threshold, the
 * greatest passing candidate wins, falling back to the greatest candidate
 * overall when none pass.
 * The wrapper owns a separate parameter Ref, but execution reads the inner
 * module's parameters. Its validated child graph includes that inner owner
 * and all descendants for discovery, optimization, and persistence. Wrapper
 * and child names must be distinct; invalid graphs fail with `CompositionError`.
 * Inner-module failures retain their original failure
 * channel. Reward failures and requirements are composed with the inner
 * module's channels without recovery or conversion to defects.
 *
 * @typeParam I - Inner module input fields.
 * @typeParam O - Inner module output fields.
 * @typeParam ModuleE - Additional checked failures from the inner module.
 * @typeParam ModuleR - Additional services required by the inner module.
 * @typeParam RewardE - Checked failures from the reward callback.
 * @typeParam RewardR - Services required by the reward callback.
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
  O extends Schema.Struct.Fields,
  ModuleE = never,
  ModuleR = never,
  RewardE = never,
  RewardR = never
>(
  options: BestOfNOptions<I, O, ModuleE, ModuleR, RewardE, RewardR>
): Effect.Effect<Module<I, O, ModuleE | RewardE, ModuleR | RewardR>, CompositionError> =>
  Effect.gen(function*() {
    const composition = yield* buildCompositionGraph({
      name: options.name,
      signature: options.module.signature,
      subModules: Record.singleton("inner", options.module)
    })
    const paramsRef = yield* Ref.make(
      makeDefaultModuleParameters(options.module.signature.instructions)
    )
    const bestOfNForward = makeBestOfNForward(options)

    return new Module({
      name: options.name,
      signature: options.module.signature,
      params: paramsRef,
      subModules: composition.subModuleNodesById,
      forward: makeComposeForward(
        new ComposeForwardOptions({
          moduleName: options.name,
          signature: options.module.signature,
          paramsRef,
          rootChildIds: composition.rootChildIds,
          graph: composition.graph,
          subModuleNodes: composition.subModuleNodesById,
          forward: ({ input }) => bestOfNForward(input)
        })
      )
    })
  })
