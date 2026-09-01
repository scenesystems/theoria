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
 * accumulated into the inner module's instructions for subsequent attempts;
 * the original parameter snapshot is restored only after normal loop
 * completion. Equal scores retain the earlier output.
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
  /** Identity of the composed module and its forward span. */
  readonly name: string
  /** Module rerun with accumulated feedback; its signature becomes the wrapper signature. */
  readonly module: Module<I, O>
  /** Maximum requested attempts, normalized to at least one. */
  readonly N: number
  /** Scores each attempt and may supply feedback for the next attempt. */
  readonly reward: RewardFn<I, O>
  /** Score that ends refinement early when reached or exceeded. */
  readonly threshold: number
}>

/**
 * Creates an iterative wrapper that refines an inner module's output.
 *
 * @remarks
 * The wrapper runs and scores the inner module sequentially up to
 * `max(1, N)` times. It stops after a score reaches `threshold`; otherwise it
 * appends accumulated reward feedback to the inner module's instructions
 * before the next attempt. The greatest-scoring output is returned.
 * The inner parameter snapshot is restored after the loop completes
 * successfully. The wrapper has a separate parameter Ref that this execution
 * path does not read. Reward callbacks cannot add an error or environment
 * channel; defects and failures from inner execution retain normal Effect
 * semantics.
 *
 * @typeParam I - Inner module input fields.
 * @typeParam O - Inner module output fields.
 * @param options - Inner module, attempt count, reward callback, threshold, and wrapper identity.
 * @returns An Effect allocating the wrapper module.
 *
 * @example
 * ```ts
 * import { Module, Signature } from "@scenesystems/effect-dsp"
 * import { Effect, Schema } from "effect"
 * import { MetricResult } from "@scenesystems/effect-dsp/contracts"
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
      makeDefaultModuleParams(options.module.signature.instructions)
    )

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
        threshold: options.threshold
      })
    })
  })
