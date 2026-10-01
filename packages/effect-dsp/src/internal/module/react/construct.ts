/**
 * Text-generation loops that can execute a handled toolkit.
 *
 * @since 0.1.0
 * @module
 */
import type * as Tool from "@effect/ai/Tool"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Effect, HashMap, Match, Number, Option, Ref, Schema } from "effect"
import type { Record } from "effect"
import { defaultReactMaxIterations, type Id, Module, type Node, type ReactOptions } from "../../../Module.js"
import { make as makeDefaultModuleParameters, type ModuleParameters } from "../../../ModuleParameters.js"
import type { Signature } from "../../../Signature.js"
import { makeReactForward, ReactRuntimeOptions } from "./runtime.js"

const normalizeMaxIterations = (maxIterations: number): number =>
  Match.value(maxIterations).pipe(
    Match.when(Schema.is(Schema.Finite), (value) => Number.max(1, Numeric.floor(value))),
    Match.orElse(() => 1)
  )

const makeInitialParams = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature<I, O>
): ModuleParameters => makeDefaultModuleParameters(signature.instructions)

/**
 * Creates a predictor that can alternate between tool calls and parsed output.
 *
 * @remarks
 * Each `forward` call snapshots the current module parameters and uses text
 * generation regardless of `outputStrategy`. Native prompt continuation retains
 * encoded tool calls and results, including return-mode failures. The next model call omits
 * the toolkit, allowing the model to consume those observations. Responses
 * without tool calls are parsed against the signature output schema; parse
 * diagnostics become feedback for a later call.
 *
 * Every completed model response records trace and usage data. Provider
 * and checked tool failures retain their native types and requirements.
 * Exhausting the call cap without parsed output
 * fails with `ParseOutputError` containing the last response and diagnostics.
 * The cap defaults to {@link defaultReactMaxIterations}; finite values are
 * rounded down, while values below one and non-finite values become one.
 *
 * @typeParam I - Signature input fields.
 * @typeParam O - Signature output fields.
 * @typeParam Tools - Toolkit's named tool record.
 * @param options - Prompt contract, handled tools, identity, and model-call cap.
 * @returns A module whose tools and model remain lazy until `forward` executes.
 *
 * @see {@link predict}
 * @see {@link chainOfThought}
 *
 * @since 0.1.0
 * @category constructors
 */
export const react = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  Tools extends Record.ReadonlyRecord<string, Tool.Any>
>(
  options: ReactOptions<I, O, Tools>
): Effect.Effect<Module<I, O, Tool.HandlerError<Tools[keyof Tools]>, Tool.Requirements<Tools[keyof Tools]>>> =>
  Effect.gen(function*() {
    const paramsRef = yield* Ref.make(makeInitialParams(options.signature))
    const maxIterations = normalizeMaxIterations(
      Option.getOrElse(Option.fromNullable(options.maxIterations), () => defaultReactMaxIterations)
    )

    return new Module({
      name: options.name,
      signature: options.signature,
      params: paramsRef,
      subModules: HashMap.empty<Id, Node>(),
      forward: makeReactForward(
        new ReactRuntimeOptions({
          moduleName: options.name,
          signature: options.signature,
          inputSchema: options.signature.inputSchema,
          outputSchema: options.signature.outputSchema,
          paramsRef,
          toolkit: options.toolkit,
          maxIterations
        })
      )
    })
  })
