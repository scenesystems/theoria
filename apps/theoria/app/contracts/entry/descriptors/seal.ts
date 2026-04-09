import { authorityCatalogForId } from "../../capability/catalog.js"
import { defaultEntrySeeds, DefaultSeedId, EmptyStruct, EntryDescriptor } from "../descriptor.js"

const sealAuthority = authorityCatalogForId("seal")

export const sealEntryDescriptor = EntryDescriptor.define({
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
  primaryAuthorityId: "seal",
  authorityIds: ["seal"],
  seeds: defaultEntrySeeds(sealAuthority.summary),
  seedIdSchema: DefaultSeedId,
  inputSchema: EmptyStruct,
  controlsSchema: EmptyStruct
})
