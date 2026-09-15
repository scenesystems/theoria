import {
  Array as Arr,
  Boolean,
  Either,
  Encoding,
  Equal,
  Match,
  Option,
  Record,
  Schema,
  String as Str,
  Tuple
} from "effect"

import { type PrimitiveChoice, PrimitiveChoiceSchema } from "../../contracts/Distribution.js"
import { type SamplerConfig, valueFromConfig } from "../configAccess.js"

export class CategoricalDimension extends Schema.Class<CategoricalDimension>("effect-search/CategoricalDimension")({
  name: Schema.String,
  choices: Schema.Array(Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null))
}) {}

export const CategoricalDimensionsSchema = Schema.Array(CategoricalDimension)

export type CategoricalDimensions = Schema.Schema.Type<typeof CategoricalDimensionsSchema>

export const ChoiceTupleSchema = Schema.Array(PrimitiveChoiceSchema)

export type ChoiceTuple = Schema.Schema.Type<typeof ChoiceTupleSchema>

export const ChoiceTuplesSchema = Schema.Array(ChoiceTupleSchema)

export type ChoiceTuples = Schema.Schema.Type<typeof ChoiceTuplesSchema>

export const ChoiceTupleKeysSchema = Schema.Array(Schema.String)

export type ChoiceTupleKeys = Schema.Schema.Type<typeof ChoiceTupleKeysSchema>

export const ChoiceConfigSchema = Schema.Record({
  key: Schema.String,
  value: PrimitiveChoiceSchema
})

export type ChoiceConfig = Schema.Schema.Type<typeof ChoiceConfigSchema>

export const ChoiceTupleLookupSchema = Schema.Record({
  key: Schema.String,
  value: ChoiceTupleSchema
})

export type ChoiceTupleLookup = Schema.Schema.Type<typeof ChoiceTupleLookupSchema>

const encodeChoice = (choice: PrimitiveChoice): Either.Either<string, Encoding.EncodeException> =>
  Match.value(choice).pipe(
    Match.when(
      Match.string,
      (value) => Encoding.encodeUriComponent(value).pipe(Either.map((key) => Str.concat("s:", key)))
    ),
    Match.when(Match.number, (value) => Either.right(`n:${value}`)),
    Match.when(
      Match.boolean,
      (value) => Either.right(Boolean.match(value, { onFalse: () => "b:0", onTrue: () => "b:1" }))
    ),
    Match.when(null, () => Either.right("z:null")),
    Match.exhaustive
  )

const readChoiceFromConfig = (
  dimension: CategoricalDimension,
  config: SamplerConfig
): Option.Option<PrimitiveChoice> =>
  valueFromConfig(config, dimension.name).pipe(
    Option.flatMap((value) => Arr.findFirst(dimension.choices, (choice) => Equal.equals(choice, value)))
  )

const appendChoice = (
  tuple: ChoiceTuple,
  choice: PrimitiveChoice
): ChoiceTuple => Arr.append(tuple, choice)

const emptyTuple = (): ChoiceTuple => Arr.empty<PrimitiveChoice>()

const valueAt = (
  values: ChoiceTuple,
  index: number
): Option.Option<PrimitiveChoice> => Arr.get(values, index)

const DimensionChoiceEntrySchema = Schema.Tuple(Schema.String, PrimitiveChoiceSchema)
type DimensionChoiceEntry = Schema.Schema.Type<typeof DimensionChoiceEntrySchema>

const DimensionChoiceEntriesSchema = Schema.Array(DimensionChoiceEntrySchema)
type DimensionChoiceEntries = Schema.Schema.Type<typeof DimensionChoiceEntriesSchema>

const appendDimensionChoice = (
  entries: DimensionChoiceEntries,
  dimension: CategoricalDimension,
  choice: PrimitiveChoice
): DimensionChoiceEntries => Arr.append(entries, Tuple.make(dimension.name, choice))

export const tupleKey = (tuple: ChoiceTuple): Either.Either<string, Encoding.EncodeException> =>
  Either.all(Arr.map(tuple, encodeChoice)).pipe(Either.map(Arr.join("|")))

export const enumerateChoiceTuples = (dimensions: CategoricalDimensions): ChoiceTuples =>
  Match.value(Arr.isEmptyReadonlyArray(dimensions)).pipe(
    Match.when(true, () => Arr.of(emptyTuple())),
    Match.orElse(() =>
      Arr.reduce<
        CategoricalDimension,
        ChoiceTuples
      >(
        dimensions,
        Arr.of(emptyTuple()),
        (tuples, dimension) =>
          Arr.flatMap(tuples, (tuple) => Arr.map(dimension.choices, (choice) => appendChoice(tuple, choice)))
      )
    )
  )

export const tupleFromConfig = (
  dimensions: CategoricalDimensions,
  config: SamplerConfig
): Option.Option<ChoiceTuple> =>
  Arr.reduce<
    CategoricalDimension,
    Option.Option<ChoiceTuple>
  >(
    dimensions,
    Option.some(emptyTuple()),
    (acc, dimension) =>
      acc.pipe(
        Option.flatMap((tuple) =>
          readChoiceFromConfig(dimension, config).pipe(
            Option.map((choice) => appendChoice(tuple, choice))
          )
        )
      )
  )

export const configFromTuple = (
  dimensions: CategoricalDimensions,
  tuple: ChoiceTuple
): Option.Option<ChoiceConfig> =>
  Arr.reduce<
    CategoricalDimension,
    Option.Option<DimensionChoiceEntries>
  >(
    dimensions,
    Option.some(Arr.empty<DimensionChoiceEntry>()),
    (acc, dimension, index) =>
      acc.pipe(
        Option.flatMap((entries) =>
          valueAt(tuple, index).pipe(
            Option.map((choice) => appendDimensionChoice(entries, dimension, choice))
          )
        )
      )
  ).pipe(Option.map((entries) => Record.fromEntries(entries)))

export const tupleLookup = (tuples: ChoiceTuples): Either.Either<ChoiceTupleLookup, Encoding.EncodeException> =>
  Either.all(Arr.map(tuples, (tuple) => tupleKey(tuple).pipe(Either.map((key) => Tuple.make(key, tuple))))).pipe(
    Either.map(Record.fromEntries)
  )
