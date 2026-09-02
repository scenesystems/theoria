/**
 * Validated compilation of flat and conditional search spaces.
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
 * Encodes ordered distribution and activation metadata as JSON.
 *
 * @remarks
 * The fingerprint excludes the executable schema and therefore does not detect
 * schema refinements or transformations that leave metadata unchanged. Parameter
 * and categorical-choice order affect the result.
 *
 * @param space - Compiled space whose parameter metadata is encoded.
 *
 * @since 0.1.0
 * @category fingerprint
 */
export const fingerprint = (space: SearchSpace): string => Schema.encodeSync(FingerprintSchema)(space.params)

/**
 * Compiles annotated dimensions into a typed configuration schema.
 *
 * @remarks
 * Each field must carry distribution metadata from a SearchSpace dimension
 * constructor. Compilation validates finite ordered bounds, integer bounds,
 * positive steps, log-scale lower bounds, and categorical values. Failures use
 * `InvalidSearchSpace`. Parameter metadata follows object key order.
 *
 * The compiled `Schema.Struct` strips excess properties when decoding. Numeric
 * distribution bounds and steps are sampling metadata and are not decode
 * refinements.
 *
 * @example
 * ```ts
 * import { Effect, Schema } from "effect"
 * import * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
 *
 * export const program = Effect.gen(function*() {
 *   const space = yield* SearchSpace.make({
 *     optimizer: SearchSpace.categorical(["adam", "sgd"]),
 *     epochs: SearchSpace.int(1, 20)
 *   })
 *   const config = yield* Schema.decodeUnknown(space.schema)({
 *     optimizer: "adam",
 *     epochs: 12
 *   })
 *
 *   return yield* Effect.succeed(config).pipe(
 *     Effect.filterOrFail(
 *       ({ optimizer, epochs }) => optimizer === "adam" && epochs === 12,
 *       () => "UnexpectedConfiguration"
 *     )
 *   )
 * })
 * ```
 *
 * @typeParam Dimensions - Field schemas whose decoded and encoded types form the configuration.
 * @param dimensions - Named schemas annotated with sampler distributions.
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
 * Compiles a flat space synchronously and defects on invalid declarations.
 *
 * @remarks
 * Prefer {@link make} when invalid user or configuration input belongs in the
 * typed error channel.
 *
 * @typeParam Dimensions - Field schemas whose decoded and encoded types form the configuration.
 * @param dimensions - Named schemas annotated with sampler distributions.
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
 * Compiles root dimensions and one conditional switch into a typed union schema.
 *
 * @remarks
 * The switch discriminant must name a root categorical dimension. Case values
 * must be unique and present in that dimension's choices; cases need not cover
 * every choice. Branch parameter names must be unique across the whole space,
 * including mutually exclusive cases. Nested activation paths are retained in
 * outer-to-inner order.
 *
 * The resulting schema strips fields that do not belong to the selected branch.
 * Validation failures use `InvalidSearchSpace`.
 *
 * @example
 * ```ts
 * import { Effect, Match, Schema } from "effect"
 * import * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
 *
 * export const program = Effect.gen(function*() {
 *   const adamSpace = yield* SearchSpace.make({ beta1: SearchSpace.float(0.8, 0.99) })
 *   const sgdSpace = yield* SearchSpace.make({ momentum: SearchSpace.float(0, 1) })
 *   const branch = SearchSpace.switch("optimizer", [
 *     SearchSpace.when("adam", adamSpace),
 *     SearchSpace.when("sgd", sgdSpace)
 *   ])
 *   const space = yield* SearchSpace.makeConditional(
 *     { optimizer: SearchSpace.categorical(["adam", "sgd"]) },
 *     branch
 *   )
 *   const config = yield* Schema.decodeUnknown(space.schema)({
 *     optimizer: "sgd",
 *     momentum: 0.9
 *   })
 *
 *   const matchesSgdBranch = Match.value(config).pipe(
 *     Match.when({ optimizer: "sgd", momentum: Match.number }, ({ momentum }) => momentum === 0.9),
 *     Match.orElse(() => false)
 *   )
 *
 *   return yield* Effect.succeed(matchesSgdBranch).pipe(
 *     Effect.filterOrFail(
 *       (matches) => matches,
 *       () => "UnexpectedConfiguration"
 *     )
 *   )
 * })
 * ```
 *
 * @typeParam Dimensions - Root field schemas shared by every branch.
 * @typeParam BranchSchema - Union schema contributed by the switch.
 * @param dimensions - Root dimensions, including the switch discriminant.
 * @param branch - Cases assembled with {@link switchOn} and {@link when}.
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
 * Compiles a conditional space synchronously and defects on invalid declarations.
 *
 * @remarks
 * Prefer {@link makeConditional} when declarations cross a fallible input
 * boundary.
 *
 * @typeParam Dimensions - Root field schemas shared by every branch.
 * @typeParam BranchSchema - Union schema contributed by the switch.
 * @param dimensions - Root dimensions, including the switch discriminant.
 * @param branch - Cases assembled with {@link switchOn} and {@link when}.
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
