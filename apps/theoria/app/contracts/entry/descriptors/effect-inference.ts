import { authorityCatalogForId } from "../../capability/catalog.js"
import { defaultEntrySeeds, DefaultSeedId, EmptyStruct, EntryDescriptor } from "../descriptor.js"

const effectInferenceAuthority = authorityCatalogForId("effect-inference")

export const effectInferenceEntryDescriptor = EntryDescriptor.define({
  entryId: "effect-inference",
  title: effectInferenceAuthority.title,
  packageName: effectInferenceAuthority.packageName,
  description: effectInferenceAuthority.description,
  useCase: effectInferenceAuthority.useCase,
  summary: effectInferenceAuthority.summary,
  runLabel: "Open Entry",
  releaseState: "coming-soon",
  path: "/effect-inference",
  interactiveLabel: null,
  primaryAuthorityId: "effect-inference",
  authorityIds: ["effect-inference"],
  seeds: defaultEntrySeeds(effectInferenceAuthority.summary),
  seedIdSchema: DefaultSeedId,
  inputSchema: EmptyStruct,
  controlsSchema: EmptyStruct
})
