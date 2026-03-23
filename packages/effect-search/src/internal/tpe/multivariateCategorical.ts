import { Array as Arr, Equal, Match, Number as Num, Option, Record, Schema, Tuple } from "effect"

import { type PrimitiveChoice, PrimitiveChoiceSchema } from "../../contracts/Distribution.js"
import { type SamplerConfig, valueFromConfig } from "../configAccess.js"

export class CategoricalDimension extends Schema.Class<CategoricalDimension>("effect-search/CategoricalDimension")({
  name: Schema.String,
  choices: Schema.Array(Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null))
}) {}

export const ChoiceTupleSchema = Schema.Array(PrimitiveChoiceSchema)

export type ChoiceTuple = Schema.Schema.Type<typeof ChoiceTupleSchema>

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

const encodeChoice = (choice: PrimitiveChoice): string =>
  Match.value(choice).pipe(
    Match.when(Match.string, (value) => `s:${encodeURIComponent(value)}`),
    Match.when(Match.number, (value) => `n:${value}`),
    Match.when(Match.boolean, (value) => `b:${value ? "1" : "0"}`),
    Match.when(null, () => "z:null"),
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
  tuple: ReadonlyArray<PrimitiveChoice>,
  choice: PrimitiveChoice
): ChoiceTuple => Arr.append(tuple, choice)

const emptyTuple = (): ChoiceTuple => Arr.empty<PrimitiveChoice>()

const valueAt = (
  values: ReadonlyArray<PrimitiveChoice>,
  index: number
): Option.Option<PrimitiveChoice> => Arr.get(values, index)

type DimensionChoiceEntry = readonly [string, PrimitiveChoice]

const appendDimensionChoice = (
  entries: ReadonlyArray<DimensionChoiceEntry>,
  dimension: CategoricalDimension,
  choice: PrimitiveChoice
): ReadonlyArray<DimensionChoiceEntry> => Arr.append(entries, Tuple.make(dimension.name, choice))

export const tupleKey = (tuple: ReadonlyArray<PrimitiveChoice>): string => Arr.join(Arr.map(tuple, encodeChoice), "|")

export const enumerateChoiceTuples = (dimensions: ReadonlyArray<CategoricalDimension>): ReadonlyArray<ChoiceTuple> =>
  Match.value(Num.lessThanOrEqualTo(dimensions.length, 0)).pipe(
    Match.when(true, () => [emptyTuple()]),
    Match.orElse(() =>
      Arr.reduce<
        CategoricalDimension,
        ReadonlyArray<ChoiceTuple>
      >(
        dimensions,
        [emptyTuple()],
        (tuples, dimension) =>
          Arr.flatMap(tuples, (tuple) => Arr.map(dimension.choices, (choice) => appendChoice(tuple, choice)))
      )
    )
  )

export const tupleFromConfig = (
  dimensions: ReadonlyArray<CategoricalDimension>,
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
  dimensions: ReadonlyArray<CategoricalDimension>,
  tuple: ReadonlyArray<PrimitiveChoice>
): Option.Option<ChoiceConfig> =>
  Arr.reduce<
    CategoricalDimension,
    Option.Option<ReadonlyArray<DimensionChoiceEntry>>
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

export const tupleLookup = (tuples: ReadonlyArray<ChoiceTuple>): ChoiceTupleLookup =>
  Record.fromEntries(Arr.map(tuples, (tuple) => Tuple.make(tupleKey(tuple), tuple)))
