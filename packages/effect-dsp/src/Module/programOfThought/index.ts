/**
 * Program-of-thought module constructor.
 *
 * @since 0.2.0
 */
import type { Schema } from "effect"
import { Effect, Match } from "effect"

import type { CompositionError } from "../../Errors/module.js"
import type { SignatureError } from "../../Errors/signature.js"
import type { Signature } from "../../Signature/model.js"
import { chainOfThought } from "../chainOfThought/index.js"
import { compose } from "../compose/index.js"
import type { Module } from "../model.js"
import { ProgramInterpreter } from "./interpreter.js"
import { ProgramOfThoughtRuntime } from "./runtime.js"
import { ProgramAnswerSignature, ProgramGenerateSignature, ProgramRepairSignature } from "./signatures.js"

/**
 * Default maximum number of planning plus repair attempts before
 * `programOfThought` stops retrying and returns the last typed error.
 *
 * @since 0.2.0
 * @category constants
 */
export const DEFAULT_PROGRAM_OF_THOUGHT_MAX_ITERATIONS = 3

/**
 * Constructor options for `Module.programOfThought`.
 *
 * @since 0.2.0
 * @category models
 */
export type ProgramOfThoughtOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = Readonly<{
  readonly name: string
  readonly signature: Signature<I, O>
  readonly maxIterations?: number
}>

const normalizeMaxIterations = (maxIterations: number): number =>
  Match.value(maxIterations).pipe(
    Match.when((value) => value < 1, () => 1),
    Match.orElse((value) => value)
  )

/**
 * Create a module that plans executable code, runs that code through the
 * injected {@link ProgramInterpreter} service captured at construction time,
 * repairs parse or execution failures, and projects the final answer back onto
 * the original signature.
 *
 * @since 0.2.0
 * @category constructors
 */
export const programOfThought = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  options: ProgramOfThoughtOptions<I, O>
): Effect.Effect<Module<I, O>, SignatureError | CompositionError, ProgramInterpreter> =>
  Effect.gen(function*() {
    const interpreter = yield* ProgramInterpreter
    const maxIterations = normalizeMaxIterations(
      options.maxIterations ?? DEFAULT_PROGRAM_OF_THOUGHT_MAX_ITERATIONS
    )
    const generateSignature = yield* ProgramGenerateSignature.fromSignature(options.signature)
    const repairSignature = yield* ProgramRepairSignature.fromSignature(options.signature)
    const answerSignature = yield* ProgramAnswerSignature.fromSignature(options.signature)
    const generate = yield* chainOfThought(`${options.name}-generate`, generateSignature)
    const repair = yield* chainOfThought(`${options.name}-repair`, repairSignature)
    const answer = yield* chainOfThought(`${options.name}-answer`, answerSignature)

    return yield* compose({
      name: options.name,
      signature: options.signature,
      subModules: {
        generate,
        repair,
        answer
      },
      forward: ({ input }) =>
        ProgramOfThoughtRuntime.forward({
          answer,
          generate,
          interpreter,
          maxIterations,
          moduleName: options.name,
          repair,
          signature: options.signature
        })(input)
    })
  })

/**
 * Program-execution service boundary and result model.
 *
 * @since 0.2.0
 */
export * from "./interpreter.js"
