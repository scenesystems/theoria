/**
 * Typed configuration spaces with sampler metadata and conditional branches.
 *
 * @since 0.7.0
 * @module
 */
import { Data, type Effect, Schema } from "effect"
import type { Chunk, HashMap } from "effect"
import { dual } from "effect/Function"

import { Choice, Distribution } from "./Distribution.js"
import * as Activity from "./internal/searchSpace/activity.js"
import * as Compile from "./internal/searchSpace/compile.js"
import * as Compose from "./internal/searchSpace/compose.js"
import * as ConditionalGroups from "./internal/searchSpace/conditionalTrace/groups.js"
import * as ConditionalPartition from "./internal/searchSpace/conditionalTrace/partition.js"
import * as Dimensions from "./internal/searchSpace/dimensions.js"
import * as SwitchOperations from "./internal/searchSpace/switch.js"
import type { InvalidSearchSpace } from "./SearchError.js"

/** Float sampling options. @since 0.7.0 @category schemas */
export const FloatOptions = Schema.Struct({
  scale: Schema.optional(Schema.Literals(["linear", "log"])),
  step: Schema.optional(Schema.Finite)
})

/** Float sampling options. @since 0.7.0 @category models */
export type FloatOptions = typeof FloatOptions.Type

/** Integer sampling options. @since 0.7.0 @category schemas */
export const IntOptions = Schema.Struct({ step: Schema.optional(Schema.Finite) })

/** Integer sampling options. @since 0.7.0 @category models */
export type IntOptions = typeof IntOptions.Type

/** One condition in a parameter activation path. @since 0.7.0 @category schemas */
export class Condition extends Schema.Class<Condition>("@scenesystems/effect-search/SearchSpace/Condition")({
  dimension: Schema.String,
  equals: Choice
}) {}

/** Sampling metadata for one named parameter. @since 0.7.0 @category schemas */
export class Parameter extends Schema.Class<Parameter>("@scenesystems/effect-search/SearchSpace/Parameter")({
  name: Schema.String,
  distribution: Distribution,
  activeWhen: Schema.Array(Condition)
}) {}

const ParameterList = Schema.Array(Parameter)
type ParameterList = typeof ParameterList.Type

type SpaceCodec = Schema.Codec<unknown, unknown, never, never>
type SpaceField = Schema.Codec<unknown, unknown, never, never>
type BranchCodec = Schema.Union<ReadonlyArray<Schema.Struct<Readonly<Record<string, SpaceField>>>>>

/** One conditional branch. @since 0.7.0 @category models */
export class Case<
  CaseSchema extends BranchCodec = BranchCodec,
  Value extends Choice = Choice
> extends Data.TaggedClass("Case")<{
  readonly when: Value
  readonly schema: CaseSchema
  readonly params: ParameterList
}> {}

/** A conditional schema selected by one categorical parameter. @since 0.7.0 @category models */
export class Switch<
  BranchSchema extends BranchCodec = BranchCodec,
  BranchCase extends Case = Case,
  Discriminant extends string = string
> extends Data.TaggedClass("Switch")<{
  readonly discriminant: Discriminant
  readonly cases: Chunk.NonEmptyChunk<BranchCase>
  readonly schema: BranchSchema
}> {}

/** A compiled search space. @since 0.7.0 @category models */
export class SearchSpace<SpaceSchema extends SpaceCodec = BranchCodec> extends Data.Class<{
  readonly schema: SpaceSchema
  readonly dimensions: HashMap.HashMap<string, SpaceField>
  readonly params: ParameterList
}> {}

/** One primitive configuration used by conditional activation analysis. @since 0.7.0 @category models */
export class ConditionalTraceTrial extends Data.Class<{
  readonly trialNumber: number
  readonly params: typeof ConditionalTraceParams.Type
}> {}

const ConditionalTraceParams = Schema.Record(Schema.String, Choice)

/** Trial identities partitioned by conditional parameter availability. @since 0.7.0 @category models */
export class ConditionalTracePartition extends Schema.Class<ConditionalTracePartition>(
  "@scenesystems/effect-search/SearchSpace/ConditionalTracePartition"
)({
  included: Schema.Array(Schema.Finite),
  excluded: Schema.Array(Schema.Finite)
}) {}

/** Independently sampled dimensions in one conditional group. @since 0.7.0 @category models */
export class ConditionalGroup extends Schema.Class<ConditionalGroup>(
  "@scenesystems/effect-search/SearchSpace/ConditionalGroup"
)({
  key: Schema.String,
  dimensions: Schema.Array(Schema.String)
}) {}

const ConditionalGroupList = Schema.Array(ConditionalGroup)
type ConditionalGroupList = typeof ConditionalGroupList.Type

/** Decoded configuration type inferred from a compiled search space. @since 0.7.0 @category models */
export type Type<Space extends SearchSpace = SearchSpace> = Space["schema"]["Type"]

/** Encoded configuration type inferred from a compiled search space. @since 0.7.0 @category models */
export type Encoded<Space extends SearchSpace = SearchSpace> = Space["schema"]["Encoded"]

/** Returns active parameter metadata. @since 0.7.0 @category combinators */
export const activeParameters: {
  (config: unknown): (self: SearchSpace) => SearchSpace["params"]
  (self: SearchSpace, config: unknown): SearchSpace["params"]
} = dual(2, (self: SearchSpace, config: unknown) => Activity.activeParameters(self, config))
/**
 * Tests every activation condition against a partial or complete configuration.
 * Missing discriminants and non-record inputs make conditional parameters inactive;
 * parameters without conditions are always active.
 *
 * @since 0.7.0
 * @category guards
 */
export const isParameterActive: {
  (config: unknown): (self: Parameter) => boolean
  (self: Parameter, config: unknown): boolean
} = dual(2, (self: Parameter, config: unknown) => Activity.isParameterActive(self, config))
/** Compiles a flat search space. @since 0.7.0 @category constructors */
export const make = <
  const Dimensions extends { readonly [key: string]: SpaceField }
>(dimensions: Dimensions) => Compile.make(dimensions)
/** Compiles a conditional search space. @since 0.7.0 @category constructors */
export const makeConditional = <
  const Dimensions extends { readonly [key: string]: SpaceField },
  BranchSchema extends BranchCodec
>(
  dimensions: Dimensions,
  branch: Switch<BranchSchema>
) => Compile.makeConditional(dimensions, branch)
/**
 * Encodes ordered distribution and activation metadata as a replay-compatibility fingerprint.
 * Executable schema refinements and transformations are intentionally excluded.
 *
 * @since 0.7.0
 * @category identity
 */
export const fingerprint = (space: SearchSpace): string => Compile.fingerprint(space)
/** Extends a search space. @since 0.7.0 @category combinators */
export const extend: {
  (right: SearchSpace): (self: SearchSpace) => Effect.Effect<SearchSpace, InvalidSearchSpace>
  (self: SearchSpace, right: SearchSpace): Effect.Effect<SearchSpace, InvalidSearchSpace>
} = dual(2, (self: SearchSpace, right: SearchSpace) => Compose.extend(self, right))
/** Projects named parameters. @since 0.7.0 @category combinators */
export const pick: {
  (names: Iterable<string>): (self: SearchSpace) => Effect.Effect<SearchSpace, InvalidSearchSpace>
  (self: SearchSpace, names: Iterable<string>): Effect.Effect<SearchSpace, InvalidSearchSpace>
} = dual(2, (self: SearchSpace, names: Iterable<string>) => Compose.pick(self, names))
/** Omits named parameters. @since 0.7.0 @category combinators */
export const omit: {
  (names: Iterable<string>): (self: SearchSpace) => Effect.Effect<SearchSpace, InvalidSearchSpace>
  (self: SearchSpace, names: Iterable<string>): Effect.Effect<SearchSpace, InvalidSearchSpace>
} = dual(2, (self: SearchSpace, names: Iterable<string>) => Compose.omit(self, names))
/** Creates a boolean parameter. @since 0.7.0 @category constructors */
export const boolean = (): Schema.Codec<boolean, boolean, never, never> => Dimensions.boolean()
/** Creates a categorical parameter. @since 0.7.0 @category constructors */
export function categorical<const Choices extends ReadonlyArray<Choice>>(
  choices: Choices
): Schema.Codec<Choices[number], Choices[number], never, never>
export function categorical(choices: ReadonlyArray<Choice>): Schema.Codec<Choice, Choice, never, never>
export function categorical(choices: ReadonlyArray<Choice>): Schema.Codec<Choice, Choice, never, never> {
  return Dimensions.categorical(choices)
}
/** Creates a fidelity parameter. @since 0.7.0 @category constructors */
export const fidelity = (low: number, high: number): Schema.Codec<number, number, never, never> =>
  Dimensions.fidelity(low, high)
/** Creates a float parameter. @since 0.7.0 @category constructors */
export const float = (
  low: number,
  high: number,
  options: FloatOptions = {}
): Schema.Codec<number, number, never, never> => Dimensions.float(low, high, options)
/** Creates an integer parameter. @since 0.7.0 @category constructors */
export const int = (low: number, high: number, options: IntOptions = {}): Schema.Codec<number, number, never, never> =>
  Dimensions.int(low, high, options)
/** Creates a conditional case. @since 0.7.0 @category constructors */
export const when = <BranchValue extends Choice, SpaceSchema extends BranchCodec>(
  value: BranchValue,
  space: SearchSpace<SpaceSchema>
): Case<SpaceSchema, BranchValue> => SwitchOperations.when(value, space)
/** Creates a conditional switch. @since 0.7.0 @category constructors */
export const switchOn = <Discriminant extends string, const BranchCase extends Case>(
  discriminant: Discriminant,
  cases: Chunk.NonEmptyChunk<BranchCase>
) => SwitchOperations.switchOn(discriminant, cases)
/** Decomposes independent conditional groups. @since 0.7.0 @category combinators */
export const decomposeConditionalGroups = (space: SearchSpace): ConditionalGroupList =>
  ConditionalGroups.decomposeConditionalGroups(space)
/** Partitions trials by required parameters. @since 0.7.0 @category combinators */
export const partitionTrialNumbersByRequiredParameters = (
  space: SearchSpace,
  requiredParameters: Iterable<string>,
  trials: Iterable<ConditionalTraceTrial>
): ConditionalTracePartition =>
  ConditionalPartition.partitionTrialNumbersByRequiredParameters(space, requiredParameters, trials)
