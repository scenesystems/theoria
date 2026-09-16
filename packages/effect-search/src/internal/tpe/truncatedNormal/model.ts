import { Data, Schema } from "effect"

export class TruncatedNormalParams extends Schema.Class<TruncatedNormalParams>("effect-search/TruncatedNormalParams")({
  mean: Schema.Number,
  sigma: Schema.Number,
  low: Schema.Number,
  high: Schema.Number
}) {}

export class StandardizedBounds extends Data.Class<{
  readonly a: number
  readonly b: number
}> {}

export class AsymptoticSeriesState extends Data.Class<{
  readonly lastTotal: number
  readonly rightHandSide: number
  readonly numerator: number
  readonly denominatorFactor: number
  readonly denominatorConstant: number
  readonly sign: number
  readonly index: number
}> {}
