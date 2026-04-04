import { Schema } from "effect"
import * as InferenceContracts from "../../../../packages/effect-inference/src/contracts/index.js"

import { Id } from "./id.js"

export const DspProvider = Schema.Literal("openai", "anthropic", "openrouter")

export type DspProvider = typeof DspProvider.Type

export const DemoCapability = Schema.Struct({
  id: Id,
  enabled: Schema.Boolean,
  reason: Schema.optional(Schema.String)
})

export type DemoCapability = typeof DemoCapability.Type

export const Capabilities = Schema.Struct({
  demos: Schema.Array(DemoCapability),
  dsp: Schema.Struct({
    provider: Schema.optional(DspProvider),
    model: Schema.optional(Schema.String),
    routeFamily: Schema.optional(InferenceContracts.StableRouteFamilySchema),
    baseUrl: Schema.optional(Schema.String)
  })
})

export type Capabilities = typeof Capabilities.Type
