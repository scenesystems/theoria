import { authorityCatalogForId } from "../../capability/catalog.js"
import { defaultEntrySeeds, DefaultSeedId, EmptyStruct, EntryDescriptor } from "../descriptor.js"

const signAuthority = authorityCatalogForId("sign")

export const signEntryDescriptor = EntryDescriptor.define({
  entryId: "sign",
  title: signAuthority.title,
  packageName: signAuthority.packageName,
  description: signAuthority.description,
  useCase: signAuthority.useCase,
  summary: signAuthority.summary,
  runLabel: "Open Entry",
  releaseState: "coming-soon",
  path: "/sign",
  interactiveLabel: null,
  primaryAuthorityId: "sign",
  authorityIds: ["sign"],
  seeds: defaultEntrySeeds(signAuthority.summary),
  seedIdSchema: DefaultSeedId,
  inputSchema: EmptyStruct,
  controlsSchema: EmptyStruct
})
