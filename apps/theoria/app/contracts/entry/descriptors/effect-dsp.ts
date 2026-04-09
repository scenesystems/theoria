import { Schema } from "effect"

import { authorityCatalogForId } from "../../capability/catalog.js"
import { DspModuleType, DspScenarioId } from "../../capability/effect-dsp.js"
import { defaultEntrySeeds, DefaultSeedId, EmptyStruct, EntryDescriptor } from "../descriptor.js"

const effectDspAuthority = authorityCatalogForId("effect-dsp")

const EffectDspEntryInput = Schema.Struct({
  scenarioId: DspScenarioId,
  moduleType: DspModuleType,
  optimizationBudget: Schema.Number.pipe(Schema.int(), Schema.between(1, 5))
})

export const effectDspEntryDescriptor = EntryDescriptor.define({
  entryId: "effect-dsp",
  title: effectDspAuthority.title,
  packageName: effectDspAuthority.packageName,
  description: effectDspAuthority.description,
  useCase: effectDspAuthority.useCase,
  summary: effectDspAuthority.summary,
  runLabel: "Run Typed Evaluation",
  releaseState: "published",
  path: "/effect-dsp",
  interactiveLabel: "Typed Evaluation",
  primaryAuthorityId: "effect-dsp",
  authorityIds: ["effect-dsp"],
  seeds: defaultEntrySeeds(effectDspAuthority.summary),
  seedIdSchema: DefaultSeedId,
  inputSchema: EffectDspEntryInput,
  controlsSchema: EmptyStruct
})
