/**
 * Sequential output refinement driven by score feedback.
 *
 * @since 0.1.0
 * @module
 */
import type { Schema } from "effect"
import { Data, Effect, Record, Ref } from "effect"
import { makeDefaultModuleParams } from "../../contracts/ModuleParams.js"
import type { RolloutCount } from "../../contracts/RolloutCount.js"
import type { CompositionError } from "../../Errors/module.js"
import type { RewardFn } from "../bestOfN/runtime.js"
import { buildCompositionGraph } from "../compose/graph.js"
import { ComposeForwardOptions, makeComposeForward } from "../compose/runtime.js"
import { Module } from "../model.js"
import { makeRefineForward } from "./runtime.js"

/**
 * Controls a score-and-feedback refinement loop over an inner module.
 *
 * @remarks
 * Attempts are sequential and stop when the best score reaches `threshold` or
 * `N` attempts have run. Below-threshold feedback is
 * accumulated into the inner module's instructions for subsequent attempts.
 * The original parameter snapshot is restored after success, failure,
 * interruption, or a defect. Equal scores retain the earlier output, and a
 * `NaN` score never replaces an earlier output.
 *
 * @see {@link refine} for construction.
 * @see {@link RewardFn} for the scoring callback contract.
 *
 * @typeParam I - Input fields accepted by the inner module.
 * @typeParam O - Output fields returned by the inner module.
 * @typeParam ModuleE - Additional checked failures from the inner module.
 * @typeParam ModuleR - Additional services required by the inner module.
 * @typeParam RewardE - Checked failures from the reward callback.
 * @typeParam RewardR - Services required by the reward callback.
 *
 * @since 0.1.0
 * @category models
 */
export class RefineOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ModuleE = never,
  ModuleR = never,
  RewardE = never,
  RewardR = never
> extends Data.Class<{
  /** Identity of the composed module and its forward span. */
  readonly name: string
  /** Module rerun with accumulated feedback; its signature becomes the wrapper signature. */
  readonly module: Module<I, O, ModuleE, ModuleR>
  /** Maximum number of attempts; the first attempt always runs. */
  readonly N: RolloutCount
  /** Scores each attempt and may supply feedback for the next attempt. */
  readonly reward: RewardFn<I, O, RewardE, RewardR>
  /** Score that ends refinement early when reached or exceeded. */
  readonly threshold: number
}> {}

/**
 * Creates an iterative wrapper that refines an inner module's output.
 *
 * @remarks
 * The wrapper runs and scores the inner module sequentially up to `N`
 * times. It stops after a score reaches `threshold`; otherwise it
 * appends accumulated reward feedback to the inner module's instructions
 * before the next attempt. The greatest-scoring output is returned.
 * Calls through the same wrapper are serialized while the inner module's
 * parameters contain refinement feedback. The original snapshot is restored on
 * every exit. Direct use or optimization of the inner module during a refinement
 * run is unsafe because those operations do not use the wrapper's lock.
 *
 * The wrapper has a separate parameter Ref that this execution path does not
 * read. Its validated child graph exposes the inner owner and all descendants
 * to discovery, optimization, and persistence. Wrapper and child names must be
 * distinct; invalid graphs fail with `CompositionError`.
 * Reward failures and requirements are composed with the inner module's
 * channels without recovery or conversion to defects. The parameter snapshot
 * is restored after either source fails and after interruption.
 *
 * @typeParam I - Inner module input fields.
 * @typeParam O - Inner module output fields.
 * @typeParam ModuleE - Additional checked failures from the inner module.
 * @typeParam ModuleR - Additional services required by the inner module.
 * @typeParam RewardE - Checked failures from the reward callback.
 * @typeParam RewardR - Services required by the reward callback.
 * @param options - Inner module, attempt count, reward callback, threshold, and wrapper identity.
 * @returns A serialized refinement wrapper with the inner module's signature.
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
  O extends Schema.Struct.Fields,
  ModuleE = never,
  ModuleR = never,
  RewardE = never,
  RewardR = never
>(
  options: RefineOptions<I, O, ModuleE, ModuleR, RewardE, RewardR>
): Effect.Effect<Module<I, O, ModuleE | RewardE, ModuleR | RewardR>, CompositionError> =>
  Effect.gen(function*() {
    const composition = yield* buildCompositionGraph({
      name: options.name,
      signature: options.module.signature,
      subModules: Record.singleton("inner", options.module)
    })
    const paramsRef = yield* Ref.make(
      makeDefaultModuleParams(options.module.signature.instructions)
    )
    const forwardLock = yield* Effect.makeSemaphore(1)
    const refineForward = makeRefineForward(options, forwardLock)

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
          forward: ({ input }) => refineForward(input)
        })
      )
    })
  })
