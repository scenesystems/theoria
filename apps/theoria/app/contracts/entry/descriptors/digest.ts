import { authorityCatalogForId } from "../../capability/catalog.js"
import { DefaultSeedId, EmptyStruct, EntryDescriptor, EntryProjectionHint, EntrySeed } from "../descriptor.js"

const digestAuthority = authorityCatalogForId("digest")

export const digestEntryDescriptor = EntryDescriptor.make({
  entryId: "digest",
  title: digestAuthority.title,
  packageName: digestAuthority.packageName,
  description: digestAuthority.description,
  useCase: digestAuthority.useCase,
  summary: digestAuthority.summary,
  runLabel: "Open Entry",
  releaseState: "coming-soon",
  path: "/digest",
  interactiveLabel: null,
  projectionHint: EntryProjectionHint.defaults(),
  primaryAuthorityId: "digest",
  authorityIds: ["digest"],
  seeds: [EntrySeed.default(digestAuthority.summary)],
  defaultSeedId: "default",
  defaultInput: {},
  defaultControls: {},
  seedIdSchema: DefaultSeedId,
  inputSchema: EmptyStruct,
  controlsSchema: EmptyStruct
})
