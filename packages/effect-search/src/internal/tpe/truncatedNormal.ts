import { Schema } from "effect"

export class TruncatedNormalParams extends Schema.Class<TruncatedNormalParams>("effect-search/TruncatedNormalParams")({
  mean: Schema.Number,
  sigma: Schema.Number,
  low: Schema.Number,
  high: Schema.Number
}) {}

export { cdf, logPdf, sample } from "./truncatedNormal/truncated.js"

export { cdfEffect, logPdfEffect, sampleEffect } from "./truncatedNormal/effect.js"
