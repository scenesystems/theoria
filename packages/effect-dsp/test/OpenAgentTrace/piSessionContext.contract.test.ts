/**
 * Contract for active-path resolution, abandoned-branch lineage, and compaction semantics.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { piMonoTaskFirstRowFixture } from "../../fixtures/open-agent-trace/pi-mono/index.js"

describe("OpenAgentTrace/piSessionContext", () => {
  it.effect("resolves one active leaf path, preserves abandoned-branch lineage, and keeps compaction as summary-first context", () =>
    Effect.gen(function*() {
      const migrated = yield* Experimental.OpenAgentTrace.PiMono.migrateSessionEntries(piMonoTaskFirstRowFixture.traces)
      const resolved = Experimental.OpenAgentTrace.PiMono.resolveSessionContext(migrated.entries)
      const liveContextIds = resolved.liveContext.map((entry) => entry.id)

      expect(resolved.selection.selectedLeafEntryId).toBe("0000000e")
      expect(resolved.selection.activePathEntryIds).toEqual([
        "00000001",
        "00000002",
        "00000003",
        "00000004",
        "00000007",
        "00000008",
        "00000009",
        "0000000a",
        "0000000b",
        "0000000c",
        "0000000d",
        "0000000e"
      ])
      expect(resolved.selection.compactedPathEntryIds).toEqual(["0000000a"])
      expect(resolved.selection.abandonedBranchRootIds).toEqual(["00000007"])
      expect(resolved.branches[0]?.leafEntryId).toBe("00000006")
      expect(resolved.branches[0]?.branchSummaryText).toContain("batched widget updates")
      expect(liveContextIds[0]).toBe("0000000a")
      expect(liveContextIds).not.toContain("00000003")
      expect(liveContextIds).not.toContain("00000008")
      expect(liveContextIds).toContain("00000004")
      expect(liveContextIds).toContain("0000000d")
      expect(liveContextIds).toContain("0000000e")
    }))
})
