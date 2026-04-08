import { authorityCatalogForId } from "../../capability/catalog.js"
import { defaultEntrySeeds, DefaultSeedId, EmptyStruct, makeEntryDescriptor } from "../descriptor.js"

const digestAuthority = authorityCatalogForId("digest")

export const digestEntryDescriptor = makeEntryDescriptor({
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
  primaryAuthorityId: "digest",
  authorityIds: ["digest"],
  seeds: defaultEntrySeeds(digestAuthority.summary),
  seedIdSchema: DefaultSeedId,
  inputSchema: EmptyStruct,
  controlsSchema: EmptyStruct
})
