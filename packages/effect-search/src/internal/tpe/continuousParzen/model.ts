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

export const PRIOR_WEIGHT = 1
export const CONSIDER_MAGIC_CLIP = true
export const CONSIDER_ENDPOINTS = false
export const EPS = 1e-12
