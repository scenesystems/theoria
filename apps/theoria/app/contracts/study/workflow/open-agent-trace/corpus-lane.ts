import { Match, Schema } from "effect"

import {
  emptyOpenAgentTraceCorpusLaneLabel,
  fixtureBackedOpenAgentTraceCorpusLaneLabel,
  OpenAgentTraceCorpusLaneLabelSchema,
  type OpenAgentTraceRegistryEntry
} from "./study-material.js"

export class OpenAgentTraceCorpusLane extends Schema.Class<OpenAgentTraceCorpusLane>("OpenAgentTraceCorpusLane")({
  label: OpenAgentTraceCorpusLaneLabelSchema
}) {
  static project(entries: ReadonlyArray<OpenAgentTraceRegistryEntry>): OpenAgentTraceCorpusLane {
    return Match.value(entries.length).pipe(
      Match.withReturnType<OpenAgentTraceCorpusLane>(),
      Match.when(0, () => OpenAgentTraceCorpusLane.make({ label: emptyOpenAgentTraceCorpusLaneLabel })),
      Match.orElse(() => OpenAgentTraceCorpusLane.make({ label: fixtureBackedOpenAgentTraceCorpusLaneLabel }))
    )
  }

  description(): string {
    return this.label === fixtureBackedOpenAgentTraceCorpusLaneLabel
      ? "The same effect-dsp corpus lane now projects trace structure, workflow shape, evaluation prompts, usage provenance, and explicit coverage through one study-facing panel."
      : "The corpus lane is wired, but no projected open-agent-trace records are currently published."
  }
}
