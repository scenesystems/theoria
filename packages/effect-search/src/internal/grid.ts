import { Array as Arr, Match, Number as Num, Schema } from "effect"

import { Choice } from "../Distribution.js"

export const FiniteDimensionSchema = Schema.Struct({
  name: Schema.String,
  values: Schema.Array(Choice)
})

export type FiniteDimension = Schema.Schema.Type<typeof FiniteDimensionSchema>

export const GridConfigSchema = Schema.Record({
  key: Schema.String,
  value: Choice
})

export type GridConfig = Schema.Schema.Type<typeof GridConfigSchema>

const GridConfigs = Schema.Array(GridConfigSchema)

export const enumerateGrid = (dimensionsInput: Iterable<FiniteDimension>) => {
  const dimensions = Arr.fromIterable(dimensionsInput)
  return Match.value(Num.lessThanOrEqualTo(Arr.length(dimensions), 0)).pipe(
    Match.when(true, () => Arr.of({})),
    Match.orElse(() =>
      Arr.reduce<FiniteDimension, typeof GridConfigs.Type>(
        dimensions,
        Arr.of({}),
        (configs, dimension) =>
          Arr.flatMap(configs, (config) =>
            Arr.map(dimension.values, (value) => ({
              ...config,
              [dimension.name]: value
            })))
      )
    )
  )
}
