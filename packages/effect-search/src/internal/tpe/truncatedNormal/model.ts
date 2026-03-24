import { Schema } from "effect"

export class TruncatedNormalParams extends Schema.Class<TruncatedNormalParams>("effect-search/TruncatedNormalParams")({
  mean: Schema.Number,
  sigma: Schema.Number,
  low: Schema.Number,
  high: Schema.Number
}) {}

export class StandardizedBounds extends Schema.Class<StandardizedBounds>("effect-search/StandardizedBounds")({
  a: Schema.Number,
  b: Schema.Number
}) {}

export class AsymptoticSeriesState extends Schema.Class<AsymptoticSeriesState>("effect-search/AsymptoticSeriesState")({
  lastTotal: Schema.Number,
  rightHandSide: Schema.Number,
  numerator: Schema.Number,
  denominatorFactor: Schema.Number,
  denominatorConstant: Schema.Number,
  sign: Schema.Number,
  index: Schema.Number
}) {}
