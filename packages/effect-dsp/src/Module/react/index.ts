/**
 * ReAct module constructor.
 *
 * @since 0.1.0
 */
import type * as Tool from "@effect/ai/Tool"
import type * as Toolkit from "@effect/ai/Toolkit"
import type { Schema } from "effect"
import { Effect, HashMap, Match, Ref } from "effect"
import type { ModuleId } from "../../contracts/ModuleId.js"
import type { ModuleNode } from "../../contracts/ModuleNode.js"
import { makeDefaultModuleParams, type ModuleParams } from "../../contracts/ModuleParams.js"
import type { Signature } from "../../Signature/model.js"
import { Module } from "../model.js"
import { makeReactForward } from "./runtime.js"

/**
 * Default cap on thought/action iterations before the module gives up
 * and fails with `ParseOutputError`.
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_REACT_MAX_ITERATIONS = 5

/**
 * Binds a signature to a handled toolkit and a normalized thought/action
 * iteration budget for a ReAct loop.
 *
 * @since 0.1.0
 * @category models
 */
export type ReactOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  Tools extends Record<string, Tool.Any>
> = Readonly<{
  readonly name: string
  readonly signature: Signature<I, O>
  readonly toolkit: Toolkit.WithHandler<Tools>
  readonly maxIterations?: number
}>

const normalizeMaxIterations = (maxIterations: number): number =>
  Match.value(maxIterations).pipe(
    Match.when((value) => value < 1, () => 1),
    Match.orElse((value) => value)
  )

const makeInitialParams = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature<I, O>
): ModuleParams => makeDefaultModuleParams(signature.instructions)

/**
 * Creates a tool-using text-output loop.
 *
 * @remarks
 * On a turn with tool calls, all returned tool
 * results are rendered into the accumulated feedback; the immediately
 * following model call omits the toolkit. On a turn without tool calls, the
 * response is parsed against the output schema. Parse diagnostics are traced
 * and fed into the next turn. Every turn appends a trace and usage sample.
 * `maxIterations` defaults to {@link DEFAULT_REACT_MAX_ITERATIONS} and values
 * below one normalize to one. Exhaustion fails with `ParseOutputError`; model
 * call failures are mapped to `TraceError` by this runtime.
 *
 * @typeParam I - Signature input fields.
 * @typeParam O - Signature output fields.
 * @typeParam Tools - Toolkit's named tool record.
 * @param options - Identity, signature, handled toolkit, and optional iteration cap.
 * @returns An Effect allocating the module; tools and the model run only on `forward`.
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
