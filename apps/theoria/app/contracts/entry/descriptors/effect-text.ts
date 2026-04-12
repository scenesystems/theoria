import { Schema } from "effect"

import { authorityCatalogForId } from "../../capability/catalog.js"
import { DefaultSeedId, EmptyStruct, EntryDescriptor, EntryProjectionHint, EntrySeed } from "../descriptor.js"

const effectTextAuthority = authorityCatalogForId("effect-text")

const EffectTextEntryInput = Schema.Struct({
  customText: Schema.String,
  viewportWidthPx: Schema.optionalWith(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.int()),
    { default: () => 0 }
  )
})

export const effectTextEntryDescriptor = EntryDescriptor.make({
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
  projectionHint: EntryProjectionHint.make({
    stage:
      "Generic text and deep-dive reflow both reuse prepared handles - drag width, toggle obstacle bands, or press Run to stream authored width checkpoints across the same prepare-once model.",
    evidence:
      "The evidence ledger tracks prepared-handle reuse, obstacle-aware projection, and optional calibration work without inventing a second browser-owned authority.",
    source:
      "Inspect the browser layer, React helper boundary, server run path, and the text consumers that share the same prepare-and-project model."
  }),
  primaryAuthorityId: "effect-text",
  authorityIds: ["effect-text"],
  seeds: [EntrySeed.default(effectTextAuthority.summary)],
  defaultSeedId: "default",
  defaultInput: {
    customText: "",
    viewportWidthPx: 0
  },
  defaultControls: {},
  seedIdSchema: DefaultSeedId,
  inputSchema: EffectTextEntryInput,
  controlsSchema: EmptyStruct
})
