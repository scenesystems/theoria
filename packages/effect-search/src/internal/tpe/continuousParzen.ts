import { Schema } from "effect"

export class ContinuousKernel extends Schema.Class<ContinuousKernel>("effect-search/ContinuousKernel")({
  mean: Schema.Number,
  sigma: Schema.Number,
  weight: Schema.Number
}) {}

export class ContinuousParzen extends Schema.Class<ContinuousParzen>("effect-search/ContinuousParzen")({
  low: Schema.Number,
  high: Schema.Number,
  kernels: Schema.Array(ContinuousKernel)
}) {}

export { buildContinuousParzen } from "./continuousParzen/build.js"

export { logDensity, logDensityEffect } from "./continuousParzen/density.js"

export { sampleFromParzen, sampleFromParzenEffect } from "./continuousParzen/sample.js"
