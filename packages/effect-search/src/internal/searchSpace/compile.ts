/**
 * Validated compilation of flat and conditional search spaces.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Schema } from "effect"

import { Parameter, SearchSpace } from "../../SearchSpace.js"
import type { Switch } from "../../SearchSpace.js"
import { compileBase } from "./compile/base.js"
import { compileWithBranch } from "./compile/branch.js"
import { ensureUniqueParameterNames } from "./validation.js"

const fingerprintSchema = () => Schema.fromJsonString(Schema.Array(Parameter))
type SpaceField = Schema.Codec<unknown, unknown, never, never>
type BranchCodec = Schema.Union<ReadonlyArray<Schema.Struct<Readonly<Record<string, SpaceField>>>>>

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
export const fingerprint = (space: SearchSpace): string => Schema.encodeSync(fingerprintSchema())(space.params)

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
 * @typeParam Dimensions - Field schemas whose decoded and encoded types form the configuration.
 * @param dimensions - Named schemas annotated with sampler distributions.
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = <
  const Dimensions extends {
    readonly [key: string]: SpaceField
  }
>(
  dimensions: Dimensions
) =>
  Effect.gen(function*() {
    const compiled = yield* compileBase(dimensions, Arr.empty())
    const params = yield* ensureUniqueParameterNames(compiled.params)
    const schema = Schema.Union([compiled.schema])

    return new SearchSpace({
      schema,
      dimensions: compiled.dimensions,
      params
    })
  })

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
    readonly [key: string]: SpaceField
  },
  BranchSchema extends BranchCodec
>(
  dimensions: Dimensions,
  branch: Switch<BranchSchema>
) =>
  Effect.gen(function*() {
    const base = yield* compileBase(dimensions, Arr.empty())
    const compiled = yield* compileWithBranch(base, branch)

    const params = yield* ensureUniqueParameterNames(compiled.params)
    const schema = compiled.schema

    return new SearchSpace({
      schema,
      dimensions: base.dimensions,
      params
    })
  })
