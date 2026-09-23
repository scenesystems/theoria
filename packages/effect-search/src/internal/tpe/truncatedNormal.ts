import { Schema } from "effect"

export const TruncatedNormalParams = Schema.Struct({
  mean: Schema.Number,
  sigma: Schema.Number,
  low: Schema.Number,
  high: Schema.Number
}).annotations({ identifier: "@scenesystems/effect-search/internal/tpe/truncatedNormal/TruncatedNormalParams" })

export type TruncatedNormalParams = typeof TruncatedNormalParams.Type

export { cdf, logPdf, sample } from "./truncatedNormal/truncated.js"

export { cdfEffect, logPdfEffect, sampleEffect } from "./truncatedNormal/effect.js"
