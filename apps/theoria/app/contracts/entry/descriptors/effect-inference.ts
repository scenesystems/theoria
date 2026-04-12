import { authorityCatalogForId } from "../../capability/catalog.js"
import { DefaultSeedId, EmptyStruct, EntryDescriptor, EntryProjectionHint, EntrySeed } from "../descriptor.js"

const effectInferenceAuthority = authorityCatalogForId("effect-inference")

export const effectInferenceEntryDescriptor = EntryDescriptor.make({
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
  projectionHint: EntryProjectionHint.defaults(),
  primaryAuthorityId: "effect-inference",
  authorityIds: ["effect-inference"],
  seeds: [EntrySeed.default(effectInferenceAuthority.summary)],
  defaultSeedId: "default",
  defaultInput: {},
  defaultControls: {},
  seedIdSchema: DefaultSeedId,
  inputSchema: EmptyStruct,
  controlsSchema: EmptyStruct
})
