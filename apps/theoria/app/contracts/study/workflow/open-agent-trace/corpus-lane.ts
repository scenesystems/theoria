import { Match, Schema } from "effect"

import { importWorkflowHookupTransport, registryWorkflowHookupTransport } from "../workflow-hookup.js"
import {
  emptyOpenAgentTraceCorpusLaneLabel,
  fixtureBackedOpenAgentTraceCorpusLaneLabel,
  importBackedOpenAgentTraceCorpusLaneLabel,
  mixedOpenAgentTraceCorpusLaneLabel,
  OpenAgentTraceCorpusLaneLabelSchema,
  type OpenAgentTraceRegistryEntry
} from "./study-material.js"

export class OpenAgentTraceCorpusLane extends Schema.Class<OpenAgentTraceCorpusLane>("OpenAgentTraceCorpusLane")({
  label: OpenAgentTraceCorpusLaneLabelSchema
}) {
  static project(entries: ReadonlyArray<OpenAgentTraceRegistryEntry>): OpenAgentTraceCorpusLane {
    const hasFixtureBackedEntries = entries.some(
      (entry) => entry.workflowHookup.transport === registryWorkflowHookupTransport
    )
    const hasImportedEntries = entries.some((entry) => entry.workflowHookup.transport === importWorkflowHookupTransport)

    return Match.value({ hasFixtureBackedEntries, hasImportedEntries, recordCount: entries.length }).pipe(
      Match.withReturnType<OpenAgentTraceCorpusLane>(),
      Match.when(
        { recordCount: 0 },
        () => OpenAgentTraceCorpusLane.make({ label: emptyOpenAgentTraceCorpusLaneLabel })
      ),
      Match.when(
        { hasFixtureBackedEntries: true, hasImportedEntries: true },
        () => OpenAgentTraceCorpusLane.make({ label: mixedOpenAgentTraceCorpusLaneLabel })
      ),
      Match.when(
        { hasFixtureBackedEntries: true, hasImportedEntries: false },
        () => OpenAgentTraceCorpusLane.make({ label: fixtureBackedOpenAgentTraceCorpusLaneLabel })
      ),
      Match.orElse(() => OpenAgentTraceCorpusLane.make({ label: importBackedOpenAgentTraceCorpusLaneLabel }))
    )
  }

  description(): string {
    if (this.label === fixtureBackedOpenAgentTraceCorpusLaneLabel) {
      return "The fixture-backed corpus lane projects trace structure, workflow shape, usage provenance, and explicit coverage through one study-facing panel."
    }

    if (this.label === importBackedOpenAgentTraceCorpusLaneLabel) {
      return "The corpus lane is currently driven by imported open-agent-trace evidence, preserving coverage and lineage without depending on checked-in fixtures."
    }

    if (this.label === mixedOpenAgentTraceCorpusLaneLabel) {
      return "The corpus lane now combines checked-in fixtures with additive imported traces so multiple source families can be inspected through the same evidentiary surface."
    }

    return "The corpus lane is wired, but no projected open-agent-trace records are currently published."
  }
}
