/**
 * Parallel batch module constructor.
 *
 * @since 0.2.0
 */
import type { Schema } from "effect"
import { Effect, Match, Schema as SchemaModule } from "effect"

import type { CompositionError } from "../../Errors/module.js"
import type { SignatureError } from "../../Errors/signature.js"
import { compose } from "../compose/index.js"
import type { Module } from "../model.js"
import { makeParallelForward } from "./runtime.js"
import { makeParallelSignature, type ParallelInputFields, type ParallelOutputFields } from "./signatures.js"

/**
 * Default concurrency used while evaluating a batch through `Module.parallel`.
 *
 * @since 0.2.0
 * @category constants
 */
export const DEFAULT_PARALLEL_CONCURRENCY = 1

/**
 * Explicit failure-policy vocabulary for `Module.parallel`.
 *
 * @since 0.2.0
 * @category models
 */
export const ParallelFailurePolicySchema = SchemaModule.Literal("fail-fast", "collect-all")

/**
 * Failure-policy type for `Module.parallel`.
 *
 * @since 0.2.0
 * @category models
 */
export type ParallelFailurePolicy = Schema.Schema.Type<typeof ParallelFailurePolicySchema>

/**
 * Default failure policy used by `Module.parallel`.
 *
 * @since 0.2.0
 * @category constants
 */
export const DEFAULT_PARALLEL_FAILURE_POLICY: ParallelFailurePolicy = "fail-fast"

/**
 * Constructor options for `Module.parallel`.
 *
 * @since 0.2.0
 * @category models
 */
export type ParallelOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = Readonly<{
  readonly name: string
  readonly module: Module<I, O>
  readonly concurrency?: number
  readonly failurePolicy?: ParallelFailurePolicy
}>

const normalizePositive = (value: number): number =>
  Match.value(value).pipe(
    Match.when((candidate) => candidate < 1, () => 1),
    Match.orElse((candidate) => candidate)
  )

/**
 * Create a module that fans out an underlying module over an ordered batch of
 * inputs while keeping concurrency and failure policy explicit.
 *
 * @since 0.2.0
 * @category constructors
 */
export const parallel = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  options: ParallelOptions<I, O>
): Effect.Effect<Module<ParallelInputFields<I>, ParallelOutputFields<O>>, SignatureError | CompositionError> =>
  Effect.gen(function*() {
    const concurrency = normalizePositive(options.concurrency ?? DEFAULT_PARALLEL_CONCURRENCY)
    const failurePolicy = options.failurePolicy ?? DEFAULT_PARALLEL_FAILURE_POLICY
    const signature = yield* makeParallelSignature({
      signature: options.module.signature
    })

    return yield* compose<ParallelInputFields<I>, ParallelOutputFields<O>>({
      name: options.name,
      signature,
      subModules: {
        branch: options.module
      },
      forward: ({ input }) =>
        makeParallelForward({
          concurrency,
          failurePolicy,
          module: options.module,
          moduleName: options.name
        })(input)
    })
  })

/**
 * Batch-signature field constants and projected field-type aliases used by
 * `Module.parallel`.
 *
 * @since 0.2.0
 */
export * from "./signatures.js"
