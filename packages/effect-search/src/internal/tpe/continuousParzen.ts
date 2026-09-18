import { Schema } from "effect"

export class ContinuousKernel extends Schema.Class<ContinuousKernel>(
  "@scenesystems/effect-search/internal/tpe/continuousParzen/ContinuousKernel"
)({
  mean: Schema.Number,
  sigma: Schema.Number,
  weight: Schema.Number
}) {}

export class ContinuousParzen extends Schema.Class<ContinuousParzen>(
  "@scenesystems/effect-search/internal/tpe/continuousParzen/ContinuousParzen"
)({
  low: Schema.Number,
  high: Schema.Number,
  kernels: Schema.Array(ContinuousKernel)
}) {}

export { buildContinuousParzen } from "./continuousParzen/build.js"

export { logDensity, logDensityEffect } from "./continuousParzen/density.js"

export { sampleFromParzen, sampleFromParzenEffect } from "./continuousParzen/sample.js"
