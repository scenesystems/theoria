import { Schema } from "effect"

import { authorityCatalogForId } from "../../capability/catalog.js"
import { optimizationTrialBudgetMax, optimizationTrialBudgetMin } from "../../capability/effect-search.js"
import { defaultEntrySeeds, DefaultSeedId, EmptyStruct, EntryDescriptor } from "../descriptor.js"

const effectSearchAuthority = authorityCatalogForId("effect-search")

const EffectSearchEntryInput = Schema.Struct({
  trialBudget: Schema.Number.pipe(
    Schema.int(),
    Schema.between(optimizationTrialBudgetMin, optimizationTrialBudgetMax)
  )
})

export const effectSearchEntryDescriptor = EntryDescriptor.define({
  entryId: "effect-search",
  title: effectSearchAuthority.title,
  packageName: effectSearchAuthority.packageName,
  description: effectSearchAuthority.description,
  useCase: effectSearchAuthority.useCase,
  summary: effectSearchAuthority.summary,
  runLabel: "Run Live Optimization",
  releaseState: "published",
  path: "/effect-search",
  interactiveLabel: "Live Optimization",
  primaryAuthorityId: "effect-search",
  authorityIds: ["effect-search"],
  seeds: defaultEntrySeeds(effectSearchAuthority.summary),
  seedIdSchema: DefaultSeedId,
  inputSchema: EffectSearchEntryInput,
  controlsSchema: EmptyStruct
})
