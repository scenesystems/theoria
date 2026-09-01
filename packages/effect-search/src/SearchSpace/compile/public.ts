/**
 * Public constructors for compiling flat and conditional search spaces from dimension declarations.
 *
 * @since 0.1.0
 */
import { Effect, Runtime, Schema } from "effect"

import { ParameterMetadata as ParameterMetadataClass, SearchSpace } from "../model.js"
import type { Switch } from "../model.js"
import { ensureUniqueParameterNames } from "../validation.js"
import { compileBase } from "./base.js"
import { compileWithBranch } from "./branch.js"

const FingerprintSchema = Schema.parseJson(Schema.Array(ParameterMetadataClass))

type ConditionalType<
  Dimensions extends {
    readonly [key: string]: Schema.Schema.AnyNoContext
  },
  BranchSchema extends Schema.Schema.AnyNoContext
> = Schema.Schema.Type<Schema.Struct<Dimensions>> & Schema.Schema.Type<BranchSchema>

type ConditionalEncoded<
  Dimensions extends {
    readonly [key: string]: Schema.Schema.AnyNoContext
  },
  BranchSchema extends Schema.Schema.AnyNoContext
> = Schema.Schema.Encoded<Schema.Struct<Dimensions>> & Schema.Schema.Encoded<BranchSchema>

/**
 * Encodes the ordered parameter metadata as deterministic JSON. The result
 * includes distributions and activation conditions, but not the schema itself.
 *
 * @since 0.1.0
 * @category fingerprint
 */
export const fingerprint = (space: SearchSpace): string => Schema.encodeSync(FingerprintSchema)(space.params)

/**
 * Compiles annotated dimensions into a decoding schema and ordered parameter
 * metadata. Validation failures are reported as `InvalidSearchSpace`.
 *
 * @example
 * ```ts
 * import { SearchSpace } from "@scenesystems/effect-search"
 *
 * const space = SearchSpace.make({
 *   optimizer: SearchSpace.categorical(["adam", "sgd"]),
 *   learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" })
 * })
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = <
  const Dimensions extends {
    readonly [key: string]: Schema.Schema.AnyNoContext
  }
>(
  dimensions: Dimensions
) =>
  Effect.gen(function*() {
    const compiled = yield* compileBase(dimensions, [])
    const params = yield* ensureUniqueParameterNames(compiled.params)
    const schema = Schema.make<
      Schema.Schema.Type<typeof compiled.schema>,
      Schema.Schema.Encoded<typeof compiled.schema>,
      never
    >(compiled.schema.ast)

    return new SearchSpace({
      schema,
      dimensions: compiled.dimensions,
      params
    })
  })

/**
 * Synchronously compiles the same result as {@link make}, converting an
 * `InvalidSearchSpace` validation failure into a defect.
 *
 * @since 0.1.0
 * @category constructors
 */
export const unsafeMake = <
  const Dimensions extends {
    readonly [key: string]: Schema.Schema.AnyNoContext
  }
>(dimensions: Dimensions) =>
  Runtime.runSync(Runtime.defaultRuntime)(
    make(dimensions).pipe(Effect.orDie)
  )

/**
 * Compiles base dimensions and a switch into a branch-sensitive union schema.
 * Branch parameters receive activation conditions, while parameter metadata
 * preserves base order followed by case order. Fails with `InvalidSearchSpace`
 * for invalid distributions, discriminants, case values, or duplicate names.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeConditional = <
  const Dimensions extends {
    readonly [key: string]: Schema.Schema.AnyNoContext
  },
  BranchSchema extends Schema.Schema.AnyNoContext
>(
  dimensions: Dimensions,
  branch: Switch<BranchSchema>
) =>
  Effect.gen(function*() {
    const base = yield* compileBase(dimensions, [])
    const compiled = yield* compileWithBranch(base, branch)

    const params = yield* ensureUniqueParameterNames(compiled.params)
    const schema = Schema.make<
      ConditionalType<Dimensions, BranchSchema>,
      ConditionalEncoded<Dimensions, BranchSchema>,
      never
    >(compiled.schema.ast)

    return new SearchSpace({
      schema,
      dimensions: base.dimensions,
      params
    })
  })

/**
 * Synchronously compiles branch-sensitive dimensions, converting an
 * `InvalidSearchSpace` validation failure into a defect.
 *
 * @since 0.1.0
 * @category constructors
 */
export const unsafeMakeConditional = <
  const Dimensions extends {
    readonly [key: string]: Schema.Schema.AnyNoContext
  },
  BranchSchema extends Schema.Schema.AnyNoContext
>(
  dimensions: Dimensions,
  branch: Switch<BranchSchema>
) =>
  Runtime.runSync(Runtime.defaultRuntime)(
    makeConditional(dimensions, branch).pipe(Effect.orDie)
  )
