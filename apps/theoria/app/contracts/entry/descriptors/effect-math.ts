import { Schema } from "effect"

import { authorityCatalogForId } from "../../capability/catalog.js"
import {
  powerAlphaMax,
  powerAlphaMin,
  powerEffectSizeMax,
  powerEffectSizeMin,
  powerSampleSizeMax,
  powerSampleSizeMin
} from "../../capability/effect-math.js"
import { defaultEntrySeeds, DefaultSeedId, EmptyStruct, makeEntryDescriptor } from "../descriptor.js"

const effectMathAuthority = authorityCatalogForId("effect-math")

const EffectMathEntryInput = Schema.Struct({
  d: Schema.Number.pipe(Schema.between(powerEffectSizeMin, powerEffectSizeMax)),
  n: Schema.Number.pipe(Schema.int(), Schema.between(powerSampleSizeMin, powerSampleSizeMax)),
  alpha: Schema.Number.pipe(Schema.between(powerAlphaMin, powerAlphaMax))
})

export const effectMathEntryDescriptor = makeEntryDescriptor({
  entryId: "effect-math",
  title: effectMathAuthority.title,
  packageName: effectMathAuthority.packageName,
  description: effectMathAuthority.description,
  useCase: effectMathAuthority.useCase,
  summary: effectMathAuthority.summary,
  runLabel: "Run Power Explorer",
  releaseState: "published",
  path: "/effect-math",
  interactiveLabel: "Power Explorer",
  primaryAuthorityId: "effect-math",
  authorityIds: ["effect-math"],
  seeds: defaultEntrySeeds(effectMathAuthority.summary),
  seedIdSchema: DefaultSeedId,
  inputSchema: EffectMathEntryInput,
  controlsSchema: EmptyStruct
})
