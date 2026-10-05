/**
 * Sequential output refinement driven by score feedback.
 *
 * @since 0.1.0
 * @module
 */
import type { Schema } from "effect"
import { Effect, Record, Ref, Semaphore } from "effect"
import type { CompositionError } from "../../../DspError.js"
import { ComposableModule, ComposeGraphOptions, Module, type RefineOptions } from "../../../Module.js"
import { predictors } from "../../../ModuleGraph.js"
import { make as makeDefaultModuleParameters } from "../../../ModuleParameters.js"
import { withPredictors } from "../../parameterBinding.js"
import { buildCompositionGraph } from "../compose/graph.js"
import { ComposeForwardOptions, makeComposeForward } from "../compose/runtime.js"
import { makeRefineForward } from "./runtime.js"

/**
 * Creates an iterative wrapper that refines an inner module's output.
 *
 * @remarks
 * The wrapper runs and scores the inner module sequentially up to `N`
 * times. It stops after a score reaches `threshold`; otherwise it
 * appends accumulated reward feedback to each leaf predictor's instructions
 * in a fiber-local overlay before the next attempt. The greatest-scoring
 * output is returned. Calls through the same wrapper are serialized; direct
 * use and optimization of the inner module remain isolated from the feedback.
 *
 * The wrapper has a separate parameter Ref that this execution path does not
 * read. Its validated child graph exposes the inner module and all descendants
 * to discovery, optimization, and persistence. Wrapper and child names must be
 * distinct; invalid graphs fail with `CompositionError`.
 * Reward failures and requirements are composed with the inner module's
 * channels without recovery or conversion to defects. Base parameters remain
 * unchanged after success, failure, and interruption.
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
    const composition = yield* buildCompositionGraph(
      new ComposeGraphOptions({
        name: options.name,
        signature: options.module.signature,
        subModules: Record.singleton("inner", options.module)
      })
    )
    const parametersRef = yield* Ref.make(
      makeDefaultModuleParameters(options.module.signature.instructions)
    )
    const forwardLock = yield* Semaphore.make(1)
    const refineForward = makeRefineForward(options, forwardLock)

    return new Module({
      name: options.name,
      signature: options.module.signature,
      parameters: parametersRef,
      subModules: composition.subModulesById,
      declarations: composition.declarations,
      forward: makeComposeForward(
        new ComposeForwardOptions({
          moduleName: options.name,
          signature: options.module.signature,
          parametersRef,
          rootChildIds: composition.rootChildIds,
          graph: composition.graph,
          subModules: composition.subModulesById,
          forward: ({ input }) =>
            refineForward(input).pipe(withPredictors(predictors(
              new ComposableModule({
                name: options.name,
                signature: options.module.signature,
                parameters: parametersRef,
                subModules: composition.subModulesById,
                declarations: composition.declarations
              })
            )))
        })
      )
    })
  })
