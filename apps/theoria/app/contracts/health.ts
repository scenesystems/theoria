import { Schema } from "effect"
import * as InferenceContracts from "../../../../packages/effect-inference/src/contracts/index.js"

import { DspProvider } from "./capabilities.js"

const NonNegativeNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

export const Live = Schema.Struct({
  status: Schema.Literal("live")
})

export type Live = typeof Live.Type

export const Ready = Schema.Struct({
  status: Schema.Literal("ready"),
  uptimeMs: NonNegativeNumber,
  dspEnabled: Schema.Boolean,
  dspProvider: Schema.optional(DspProvider),
  dspModel: Schema.optional(Schema.String),
  dspRouteFamily: Schema.optional(InferenceContracts.StableRouteFamilySchema),
  dspBaseUrl: Schema.optional(Schema.String)
})

export type Ready = typeof Ready.Type
