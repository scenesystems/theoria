import { authorityCatalogForId } from "../../capability/catalog.js"
import { SearchConfig } from "../../capability/effect-search.js"
import { DefaultSeedId, EmptyStruct, EntryDescriptor, EntryProjectionHint, EntrySeed } from "../descriptor.js"

const effectSearchAuthority = authorityCatalogForId("effect-search")

export const effectSearchEntryDescriptor = EntryDescriptor.make({
  entryId: "effect-search",
  title: effectSearchAuthority.title,
  packageName: effectSearchAuthority.packageName,
  description: effectSearchAuthority.description,
  useCase: effectSearchAuthority.useCase,
  summary: effectSearchAuthority.summary,
  runLabel: "Run Live Optimization",
  releaseState: "published",
  path: "/effect-search",
  interactiveLabel: "Live Optimization",
  projectionHint: EntryProjectionHint.make({
    stage:
      "Set a trial budget, press Run, and watch authored TPE and Random checkpoints arrive on one shared study stream while the browser only projects the current frame.",
    evidence:
      "Full optimization results comparing TPE vs Random search - every trial coordinate and convergence curve is reproducible from a fixed seed.",
    source: EntryProjectionHint.defaults().source
  }),
  primaryAuthorityId: "effect-search",
  authorityIds: ["effect-search"],
  seeds: [EntrySeed.default(effectSearchAuthority.summary)],
  defaultSeedId: "default",
  defaultInput: SearchConfig.defaults(),
  defaultControls: {},
  seedIdSchema: DefaultSeedId,
  inputSchema: SearchConfig,
  controlsSchema: EmptyStruct
})
