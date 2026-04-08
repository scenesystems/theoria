import { Schema } from "effect"

import { authorityCatalogForId } from "../../capability/catalog.js"
import { defaultEntrySeeds, DefaultSeedId, EmptyStruct, makeEntryDescriptor } from "../descriptor.js"

const effectTextAuthority = authorityCatalogForId("effect-text")

const EffectTextEntryInput = Schema.Struct({
  customText: Schema.String,
  viewportWidthPx: Schema.optionalWith(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.int()),
    { default: () => 0 }
  )
})

export const effectTextEntryDescriptor = makeEntryDescriptor({
  entryId: "effect-text",
  title: effectTextAuthority.title,
  packageName: effectTextAuthority.packageName,
  description: effectTextAuthority.description,
  useCase: effectTextAuthority.useCase,
  summary: effectTextAuthority.summary,
  runLabel: "Run Live Reflow",
  releaseState: "published",
  path: "/effect-text",
  interactiveLabel: "Live Reflow",
  primaryAuthorityId: "effect-text",
  authorityIds: ["effect-text"],
  seeds: defaultEntrySeeds(effectTextAuthority.summary),
  seedIdSchema: DefaultSeedId,
  inputSchema: EffectTextEntryInput,
  controlsSchema: EmptyStruct
})
