import { authorityCatalogForId } from "../../capability/catalog.js"
import { DefaultSeedId, EmptyStruct, EntryDescriptor, EntryProjectionHint, EntrySeed } from "../descriptor.js"

const sealAuthority = authorityCatalogForId("seal")

export const sealEntryDescriptor = EntryDescriptor.make({
  entryId: "seal",
  title: sealAuthority.title,
  packageName: sealAuthority.packageName,
  description: sealAuthority.description,
  useCase: sealAuthority.useCase,
  summary: sealAuthority.summary,
  runLabel: "Open Entry",
  releaseState: "coming-soon",
  path: "/seal",
  interactiveLabel: null,
  projectionHint: EntryProjectionHint.defaults(),
  primaryAuthorityId: "seal",
  authorityIds: ["seal"],
  seeds: [EntrySeed.default(sealAuthority.summary)],
  defaultSeedId: "default",
  defaultInput: {},
  defaultControls: {},
  seedIdSchema: DefaultSeedId,
  inputSchema: EmptyStruct,
  controlsSchema: EmptyStruct
})
