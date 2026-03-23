import { Array as Arr, Match, Schema } from "effect"

import { PrimitiveChoiceSchema } from "../contracts/Distribution.js"

export const FiniteDimensionSchema = Schema.Struct({
  name: Schema.String,
  values: Schema.Array(PrimitiveChoiceSchema)
})

export type FiniteDimension = Schema.Schema.Type<typeof FiniteDimensionSchema>

export const GridConfigSchema = Schema.Record({
  key: Schema.String,
  value: PrimitiveChoiceSchema
})

export type GridConfig = Schema.Schema.Type<typeof GridConfigSchema>

export const enumerateGrid = (dimensions: ReadonlyArray<FiniteDimension>): ReadonlyArray<GridConfig> =>
  Match.value(dimensions.length <= 0).pipe(
    Match.when(true, () => [{}]),
    Match.orElse(() =>
      Arr.reduce<FiniteDimension, ReadonlyArray<GridConfig>>(
        dimensions,
        [{}],
        (configs, dimension) =>
          Arr.flatMap(configs, (config) =>
            Arr.map(dimension.values, (value) => ({
              ...config,
              [dimension.name]: value
            })))
      )
    )
  )
