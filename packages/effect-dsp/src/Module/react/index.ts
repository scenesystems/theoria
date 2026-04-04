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
 * Configuration for a ReAct module: signature, toolkit of available tools,
 * and optional iteration cap.
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
 * Create a ReAct module that interleaves language model reasoning with
 * tool calls across multiple iterations. Each iteration either calls
 * tools (whose observations become feedback) or attempts to parse a
 * final answer. Fails with `ParseOutputError` after exhausting
 * `maxIterations`.
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
