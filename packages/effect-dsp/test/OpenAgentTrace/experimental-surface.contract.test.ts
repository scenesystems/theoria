import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  piMonoChatContinuationRowFixture,
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "../../fixtures/open-agent-trace/pi-mono/index.js"
import coverageSummaryJson from "../fixtures/open-agent-trace/pi-mono/coverage-summary.json" with { type: "json" }

const packageRootUrl = new URL("../../", import.meta.url)
const promotionRule =
  "Stable promotion requires a second public dataset with a materially different event grammar decoding through the same normalized corpus family while keeping projection coverage explicit."
const stopRule =
  "If branch lineage, redaction provenance, or workflow projection cannot remain explicit without app-local heuristics, the lane stays experimental and read-only."

const CoverageSummaryRecord = Schema.Struct({
  entryId: Schema.Literal("task-first", "chat-continuation"),
  workflowKind: Schema.Literal("task-first", "chat-continuation"),
  eventKinds: Schema.Array(Schema.String),
  coverageKinds: Schema.Array(Schema.String),
  coverageReasons: Schema.Array(Schema.String)
})

const CoverageSummary = Schema.Struct({
  surface: Schema.Literal("open-agent-trace"),
  status: Schema.Literal("experimental"),
  fixtureBacked: Schema.Boolean,
  datasetId: Schema.Literal("badlogicgames/pi-mono"),
  promotionRule: Schema.String,
  stopRule: Schema.String,
  stableReady: Schema.Boolean,
  records: Schema.Array(CoverageSummaryRecord)
})

const datasetAuthority: {
  readonly datasetId: string
  readonly datasetRevision: string
  readonly split: string
  readonly sourceUrl: string
  readonly licenseTag: string
} = {
  datasetId: "badlogicgames/pi-mono",
  datasetRevision: "main",
  split: "train",
  sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
  licenseTag: "cc-by-4.0"
}

const decodedFixtures = Effect.all({
  manifestEntry: Experimental.OpenAgentTrace.PiMono.decodeManifestEntry(piShareHfManifestFixture),
  reviewSidecar: Experimental.OpenAgentTrace.PiMono.decodeReviewSidecar(piShareHfReviewSidecarFixture)
})

const coverageRecord = (options: {
  readonly entryId: "task-first" | "chat-continuation"
  readonly rowFixture: unknown
}) =>
  Effect.gen(function*() {
    const fixtures = yield* decodedFixtures
    const row = yield* Experimental.OpenAgentTrace.PiMono.decodeDatasetRow(options.rowFixture)
    const record = yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
      ...datasetAuthority,
      manifestEntry: fixtures.manifestEntry,
      reviewSidecar: fixtures.reviewSidecar,
      row
    })
    const projection = yield* Experimental.OpenAgentTrace.WorkflowProjection.project(record)

    return {
      entryId: options.entryId,
      workflowKind: projection.workflowRecord.workflowKind,
      eventKinds: record.events.map((event) => event.eventKind),
      coverageKinds: projection.coverageGaps.map((gap) => gap.sourceKind),
      coverageReasons: projection.coverageGaps.map((gap) => gap.reason)
    }
  })

describe("OpenAgentTrace/experimental-surface", () => {
  it.effect("keeps the corpus lane explicitly experimental, fixture-backed, and governed by executable promotion and stop rules", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)
      const summary = yield* Schema.decodeUnknown(CoverageSummary)(coverageSummaryJson)
      const records = yield* Effect.all(
        [
          coverageRecord({ entryId: "task-first", rowFixture: piMonoTaskFirstRowFixture }),
          coverageRecord({ entryId: "chat-continuation", rowFixture: piMonoChatContinuationRowFixture })
        ],
        { concurrency: 1 }
      )

      expect(Experimental._experimental).toBe(true)
      expect(summary.surface).toBe("open-agent-trace")
      expect(summary.status).toBe("experimental")
      expect(summary.fixtureBacked).toBe(true)
      expect(summary.datasetId).toBe("badlogicgames/pi-mono")
      expect(summary.stableReady).toBe(false)
      expect(summary.promotionRule).toBe(promotionRule)
      expect(summary.stopRule).toBe(stopRule)
      expect(summary.records).toEqual(records)
      expect(readme).toContain("effect-dsp/experimental")
      expect(readme).toContain(promotionRule)
      expect(readme).toContain(stopRule)
    }).pipe(Effect.provide(BunContext.layer)))
})
