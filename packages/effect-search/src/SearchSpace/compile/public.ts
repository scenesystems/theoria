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
 * Compute a deterministic fingerprint from a search space's parameter metadata.
 *
 * @since 0.1.0
 * @category utils
 */
export const fingerprint = (space: SearchSpace): string => Schema.encodeSync(FingerprintSchema)(space.params)

/**
 * Compile a flat search space from dimension declarations.
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
 * Compile a flat search space from dimension declarations and throw defects on validation failure.
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
 * Compile a conditional search space with a switch branch.
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
 * Compile a conditional search space with a switch branch and throw defects on validation failure.
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
