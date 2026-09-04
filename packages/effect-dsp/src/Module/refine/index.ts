/**
 * Sequential output refinement driven by score feedback.
 *
 * @since 0.1.0
 * @module
 */
import type { Schema } from "effect"
import { Data, Effect, HashMap, Ref } from "effect"
import type { ModuleId } from "../../contracts/ModuleId.js"
import type { ModuleNode } from "../../contracts/ModuleNode.js"
import { makeDefaultModuleParams } from "../../contracts/ModuleParams.js"
import type { RewardFn } from "../bestOfN/runtime.js"
import { Module } from "../model.js"
import { makeRefineForward } from "./runtime.js"

/**
 * Controls a score-and-feedback refinement loop over an inner module.
 *
 * @remarks
 * Attempts are sequential and stop when the best score reaches `threshold` or
 * the normalized attempt limit is exhausted. Below-threshold feedback is
 * accumulated into the inner module's instructions for subsequent attempts.
 * The original parameter snapshot is restored after success, failure,
 * interruption, or a defect. Equal scores retain the earlier output.
 *
 * @see {@link refine} for construction.
 * @see {@link RewardFn} for the scoring callback contract.
 *
 * @typeParam I - Input fields accepted by the inner module.
 * @typeParam O - Output fields returned by the inner module.
 *
 * @since 0.1.0
 * @category models
 */
export class RefineOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> extends Data.Class<{
  /** Identity of the composed module and its forward span. */
  readonly name: string
  /** Module rerun with accumulated feedback; its signature becomes the wrapper signature. */
  readonly module: Module<I, O>
  /** Maximum attempts, rounded down and normalized to one when invalid or below one. */
  readonly N: number
  /** Scores each attempt and may supply feedback for the next attempt. */
  readonly reward: RewardFn<I, O>
  /** Score that ends refinement early when reached or exceeded. */
  readonly threshold: number
}> {}

/**
 * Creates an iterative wrapper that refines an inner module's output.
 *
 * @remarks
 * The wrapper runs and scores the inner module sequentially up to
 * the normalized attempt count. It stops after a score reaches `threshold`; otherwise it
 * appends accumulated reward feedback to the inner module's instructions
 * before the next attempt. The greatest-scoring output is returned.
 * Calls through the same wrapper are serialized while the inner module's
 * parameters contain refinement feedback. The original snapshot is restored on
 * every exit. Direct use or optimization of the inner module during a refinement
 * run is unsafe because those operations do not use the wrapper's lock.
 *
 * The wrapper has a separate parameter Ref that this execution path does not
 * read. Reward callbacks cannot add a typed error or environment requirement.
 * Inner failures remain typed failures, and callback defects remain defects.
 *
 * @typeParam I - Inner module input fields.
 * @typeParam O - Inner module output fields.
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
  O extends Schema.Struct.Fields
>(
  options: RefineOptions<I, O>
): Effect.Effect<Module<I, O>> =>
  Effect.gen(function*() {
    const paramsRef = yield* Ref.make(
      makeDefaultModuleParams(options.module.signature.instructions)
    )
    const forwardLock = yield* Effect.makeSemaphore(1)

    return new Module({
      name: options.name,
      signature: options.module.signature,
      params: paramsRef,
      subModules: HashMap.empty<ModuleId, ModuleNode>(),
      forward: makeRefineForward({
        moduleName: options.name,
        signature: options.module.signature,
        innerModule: options.module,
        N: options.N,
        reward: options.reward,
        threshold: options.threshold,
        forwardLock
      })
    })
  })
