import { Schema } from "effect"

import { authorityCatalogForId } from "../../capability/catalog.js"
import {
  powerAlphaMax,
  powerAlphaMin,
  PowerControls,
  powerEffectSizeMax,
  powerEffectSizeMin,
  powerSampleSizeMax,
  powerSampleSizeMin
} from "../../capability/effect-math.js"
import { DefaultSeedId, EmptyStruct, EntryDescriptor, EntryProjectionHint, EntrySeed } from "../descriptor.js"

const effectMathAuthority = authorityCatalogForId("effect-math")

const EffectMathEntryInput = Schema.Struct({
  d: Schema.Number.pipe(Schema.between(powerEffectSizeMin, powerEffectSizeMax)),
  n: Schema.Number.pipe(Schema.int(), Schema.between(powerSampleSizeMin, powerSampleSizeMax)),
  alpha: Schema.Number.pipe(Schema.between(powerAlphaMin, powerAlphaMax))
})

export const effectMathEntryDescriptor = EntryDescriptor.make({
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
  projectionHint: EntryProjectionHint.make({
    stage:
      "Sweep effect sizes and sample sizes by streaming authored power checkpoints from effect-math's statistical kernels into one shared runtime spine.",
    evidence:
      "Live power-analysis reports, confidence intervals, and solver statuses streamed from effect-math Statistics and Optimization surfaces with no app-local inference formulas.",
    source: EntryProjectionHint.defaults().source
  }),
  primaryAuthorityId: "effect-math",
  authorityIds: ["effect-math"],
  seeds: [EntrySeed.default(effectMathAuthority.summary)],
  defaultSeedId: "default",
  defaultInput: PowerControls.defaults(),
  defaultControls: {},
  seedIdSchema: DefaultSeedId,
  inputSchema: EffectMathEntryInput,
  controlsSchema: EmptyStruct
})
