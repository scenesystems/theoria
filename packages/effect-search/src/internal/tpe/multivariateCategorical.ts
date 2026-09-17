import { Array as Arr, Either, Encoding, Equal, Match, Number as Num, Option, Record, Schema, Tuple } from "effect"

import { Choice } from "../../Distribution.js"
import { type SamplerConfig, valueFromConfig } from "../configAccess.js"

export class CategoricalDimension extends Schema.Class<CategoricalDimension>(
  "@scenesystems/effect-search/internal/tpe/multivariateCategorical/CategoricalDimension"
)({
  name: Schema.String,
  choices: Schema.Array(Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null))
}) {}

export const ChoiceTupleSchema = Schema.Array(Choice)

export type ChoiceTuple = Schema.Schema.Type<typeof ChoiceTupleSchema>

const ChoiceTuples = Schema.Array(ChoiceTupleSchema)

export const ChoiceConfigSchema = Schema.Record({
  key: Schema.String,
  value: Choice
})

export type ChoiceConfig = Schema.Schema.Type<typeof ChoiceConfigSchema>

export const ChoiceTupleLookupSchema = Schema.Record({
  key: Schema.String,
  value: ChoiceTupleSchema
})

export type ChoiceTupleLookup = Schema.Schema.Type<typeof ChoiceTupleLookupSchema>

const encodeChoice = (choice: Choice): Either.Either<string, Encoding.EncodeException> =>
  Match.value(choice).pipe(
    Match.when(Match.string, (value) => Encoding.encodeUriComponent(value).pipe(Either.map((key) => `s:${key}`))),
    Match.when(Match.number, (value) => Either.right(`n:${value}`)),
    Match.when(Match.boolean, (value) =>
      Either.right(
        Match.value(value).pipe(
          Match.when(true, () => "b:1"),
          Match.orElse(() => "b:0")
        )
      )),
    Match.when(null, () => Either.right("z:null")),
    Match.exhaustive
  )

const readChoiceFromConfig = (
  dimension: CategoricalDimension,
  config: SamplerConfig
): Option.Option<Choice> =>
  valueFromConfig(config, dimension.name).pipe(
    Option.flatMap((value) => Arr.findFirst(dimension.choices, (choice) => Equal.equals(choice, value)))
  )

const appendChoice = (
  tupleInput: Iterable<Choice>,
  choice: Choice
): ChoiceTuple => {
  const tuple = Arr.fromIterable(tupleInput)
  return Arr.append(tuple, choice)
}

const emptyTuple = (): ChoiceTuple => Arr.empty<Choice>()

const valueAt = (
  valuesInput: Iterable<Choice>,
  index: number
): Option.Option<Choice> => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.get(values, index)
}

const DimensionChoiceEntry = Schema.Tuple(Schema.String, Choice)
type DimensionChoiceEntry = typeof DimensionChoiceEntry.Type
const DimensionChoiceEntries = Schema.Array(DimensionChoiceEntry)

const appendDimensionChoice = (
  entriesInput: Iterable<DimensionChoiceEntry>,
  dimension: CategoricalDimension,
  choice: Choice
) => {
  const entries = Arr.fromIterable(entriesInput)
  return Arr.append(entries, Tuple.make(dimension.name, choice))
}

export const tupleKey = (tupleInput: Iterable<Choice>): Either.Either<string, Encoding.EncodeException> => {
  const tuple = Arr.fromIterable(tupleInput)
  return Either.all(Arr.map(tuple, encodeChoice)).pipe(Either.map(Arr.join("|")))
}

export const enumerateChoiceTuples = (dimensionsInput: Iterable<CategoricalDimension>) => {
  const dimensions = Arr.fromIterable(dimensionsInput)
  return Match.value(Num.lessThanOrEqualTo(Arr.length(dimensions), 0)).pipe(
    Match.when(true, () => Arr.of(emptyTuple())),
    Match.orElse(() =>
      Arr.reduce<
        CategoricalDimension,
        typeof ChoiceTuples.Type
      >(
        dimensions,
        Arr.of(emptyTuple()),
        (tuples, dimension) =>
          Arr.flatMap(tuples, (tuple) => Arr.map(dimension.choices, (choice) => appendChoice(tuple, choice)))
      )
    )
  )
}

export const tupleFromConfig = (
  dimensionsInput: Iterable<CategoricalDimension>,
  config: SamplerConfig
): Option.Option<ChoiceTuple> => {
  const dimensions = Arr.fromIterable(dimensionsInput)
  return Arr.reduce<
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
}

export const configFromTuple = (
  dimensionsInput: Iterable<CategoricalDimension>,
  tupleInput: Iterable<Choice>
): Option.Option<ChoiceConfig> => {
  const dimensions = Arr.fromIterable(dimensionsInput)
  const tuple = Arr.fromIterable(tupleInput)
  return Arr.reduce<
    CategoricalDimension,
    Option.Option<typeof DimensionChoiceEntries.Type>
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
}

export const tupleLookup = (
  tuplesInput: Iterable<ChoiceTuple>
): Either.Either<ChoiceTupleLookup, Encoding.EncodeException> => {
  const tuples = Arr.fromIterable(tuplesInput)
  return Either.all(
    Arr.map(tuples, (tuple) => tupleKey(tuple).pipe(Either.map((key) => Tuple.make(key, tuple))))
  ).pipe(Either.map(Record.fromEntries))
}
