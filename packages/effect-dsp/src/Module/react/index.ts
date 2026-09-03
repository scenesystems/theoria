/**
 * Text-generation loops that can execute a handled toolkit.
 *
 * @since 0.1.0
 */
import type * as Tool from "@effect/ai/Tool"
import type * as Toolkit from "@effect/ai/Toolkit"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import type { Schema } from "effect"
import { Effect, HashMap, Match, Ref } from "effect"
import type { ModuleId } from "../../contracts/ModuleId.js"
import type { ModuleNode } from "../../contracts/ModuleNode.js"
import { makeDefaultModuleParams, type ModuleParams } from "../../contracts/ModuleParams.js"
import type { Signature } from "../../Signature/model.js"
import { Module } from "../model.js"
import { makeReactForward } from "./runtime.js"

/**
 * Limits ReAct model calls to five when no per-module value is supplied.
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_REACT_MAX_ITERATIONS = 5

/**
 * Configures one tool-capable text-generation loop.
 *
 * @typeParam I - Input fields accepted by the module.
 * @typeParam O - Output fields parsed from a final text response.
 * @typeParam Tools - Named tools available through the handled toolkit.
 *
 * @since 0.1.0
 * @category models
 */
export type ReactOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  Tools extends Record<string, Tool.Any>
> = Readonly<{
  /** Identity used for discovery, tracing, and failure diagnostics. */
  readonly name: string
  /** Prompt and parse contract for the loop. */
  readonly signature: Signature<I, O>
  /** Tool definitions with handlers passed to eligible model calls. */
  readonly toolkit: Toolkit.WithHandler<Tools>
  /** Model-call cap; finite values are rounded down and normalized to at least one. */
  readonly maxIterations?: number
}>

const normalizeMaxIterations = (maxIterations: number): number =>
  Match.value(maxIterations).pipe(
    Match.when(Numeric.isFinite, (value) => Numeric.max(1, Numeric.floor(value))),
    Match.orElse(() => 1)
  )

const makeInitialParams = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature<I, O>
): ModuleParams => makeDefaultModuleParams(signature.instructions)

/**
 * Creates a predictor that can alternate between tool calls and parsed output.
 *
 * @remarks
 * Each `forward` call snapshots the current module parameters and uses text
 * generation regardless of `outputStrategy`. A response with tool calls adds
 * all returned tool results to the feedback history. The next model call omits
 * the toolkit, allowing the model to consume those observations. Responses
 * without tool calls are parsed against the signature output schema; parse
 * diagnostics become feedback for a later call.
 *
 * Every completed model response records trace and usage data. Provider
 * failures become `TraceError`. Exhausting the call cap without parsed output
 * fails with `ParseOutputError` containing the last response and diagnostics.
 * The cap defaults to {@link DEFAULT_REACT_MAX_ITERATIONS}; finite values are
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
  Tools extends Record<string, Tool.Any>
>(
  options: ReactOptions<I, O, Tools>
): Effect.Effect<Module<I, O>> =>
  Effect.gen(function*() {
    const paramsRef = yield* Ref.make(makeInitialParams(options.signature))
    const maxIterations = normalizeMaxIterations(
      options.maxIterations ?? DEFAULT_REACT_MAX_ITERATIONS
    )

    return new Module({
      name: options.name,
      signature: options.signature,
      params: paramsRef,
      subModules: HashMap.empty<ModuleId, ModuleNode>(),
      forward: makeReactForward({
        moduleName: options.name,
        signature: options.signature,
        inputSchema: options.signature.inputSchema,
        outputSchema: options.signature.outputSchema,
        paramsRef,
        toolkit: options.toolkit,
        maxIterations
      })
    })
  })
