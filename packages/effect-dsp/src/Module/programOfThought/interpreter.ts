/**
 * Program-execution service boundary for `Module.programOfThought`.
 *
 * @since 0.2.0
 */
import type { Effect } from "effect"
import { Context, Schema } from "effect"

import { FieldRecord } from "../../contracts/FieldValue.js"
import type { ProgramExecutionError, ProgramRuntimeBoundaryError } from "../../Errors/module.js"

/**
 * Request emitted by `Module.programOfThought` when a generated program body
 * needs to execute against the injected interpreter boundary.
 *
 * @since 0.2.0
 * @category models
 */
export type ProgramExecutionRequest = Readonly<{
  readonly moduleName: string
  readonly attempt: number
  readonly code: string
  readonly input: Schema.Schema.Type<typeof FieldRecord>
}>

/**
 * Normalized execution result returned by the injected interpreter boundary.
 * `codeOutput` is the canonical text fed back into the answer-projection step,
 * while `submission` preserves any structured payload the interpreter wants to
 * surface for later evidence projections.
 *
 * @since 0.2.0
 * @category models
 */
export class ProgramExecutionResult extends Schema.Class<ProgramExecutionResult>("ProgramExecutionResult")({
  codeOutput: Schema.String,
  submission: Schema.NullOr(FieldRecord)
}) {}

/**
 * Effect service boundary for executing generated program bodies.
 * Consumers provide a deterministic test interpreter or a real runtime at
 * module-construction time.
 *
 * @since 0.2.0
 * @category models
 */
export class ProgramInterpreter extends Context.Tag("effect-dsp/Module/ProgramInterpreter")<
  ProgramInterpreter,
  {
    readonly execute: (
      request: ProgramExecutionRequest
    ) => Effect.Effect<
      ProgramExecutionResult,
      ProgramExecutionError | ProgramRuntimeBoundaryError
    >
  }
>() {}

/**
 * Service API extracted from {@link ProgramInterpreter}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type ProgramInterpreterApi = Context.Tag.Service<typeof ProgramInterpreter>
