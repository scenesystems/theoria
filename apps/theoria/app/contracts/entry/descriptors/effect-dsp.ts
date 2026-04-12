import { authorityCatalogForId } from "../../capability/catalog.js"
import { DspRunRequest } from "../../capability/effect-dsp.js"
import { DefaultSeedId, EmptyStruct, EntryDescriptor, EntryProjectionHint, EntrySeed } from "../descriptor.js"

const effectDspAuthority = authorityCatalogForId("effect-dsp")

export const effectDspEntryDescriptor = EntryDescriptor.make({
  entryId: "effect-dsp",
  title: effectDspAuthority.title,
  packageName: effectDspAuthority.packageName,
  description: effectDspAuthority.description,
  useCase: effectDspAuthority.useCase,
  summary: effectDspAuthority.summary,
  runLabel: "Run Typed Evaluation",
  releaseState: "published",
  path: "/effect-dsp",
  interactiveLabel: "Typed Evaluation",
  projectionHint: EntryProjectionHint.make({
    stage:
      "Inspect typed sentiment evaluations case-by-case on the same authored step stream that freezes the contract, runs the provider-backed program, and reports the comparison.",
    evidence:
      "Provider-backed evaluation traces, correctness deltas, and runtime metadata - every run records the typed program, baseline, and outcome together.",
    source: EntryProjectionHint.defaults().source
  }),
  primaryAuthorityId: "effect-dsp",
  authorityIds: ["effect-dsp"],
  seeds: [EntrySeed.default(effectDspAuthority.summary)],
  defaultSeedId: "default",
  defaultInput: DspRunRequest.defaults(),
  defaultControls: {},
  seedIdSchema: DefaultSeedId,
  inputSchema: DspRunRequest,
  controlsSchema: EmptyStruct
})
