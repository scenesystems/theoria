import { authorityCatalogForId } from "../../capability/catalog.js"
import { DefaultSeedId, EmptyStruct, EntryDescriptor, EntryProjectionHint, EntrySeed } from "../descriptor.js"

const signAuthority = authorityCatalogForId("sign")

export const signEntryDescriptor = EntryDescriptor.make({
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
  projectionHint: EntryProjectionHint.defaults(),
  primaryAuthorityId: "sign",
  authorityIds: ["sign"],
  seeds: [EntrySeed.default(signAuthority.summary)],
  defaultSeedId: "default",
  defaultInput: {},
  defaultControls: {},
  seedIdSchema: DefaultSeedId,
  inputSchema: EmptyStruct,
  controlsSchema: EmptyStruct
})
