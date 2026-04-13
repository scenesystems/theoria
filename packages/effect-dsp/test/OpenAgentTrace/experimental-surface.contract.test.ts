import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Record, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { loadCatalog, loadPluginAdapterCapture } from "../../fixtures/open-agent-trace/amp/index.js"
import {
  piMonoChatContinuationRowFixture,
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "../../fixtures/open-agent-trace/pi-mono/index.js"
import coverageSummaryJson from "../fixtures/open-agent-trace/pi-mono/coverage-summary.json" with { type: "json" }

const packageRootUrl = new URL("../../", import.meta.url)
const coveragePromotionRule =
  "Stable promotion requires a second public dataset with a materially different event grammar decoding through the same normalized corpus family while keeping projection coverage explicit."
const coverageStopRule =
  "If branch lineage, redaction provenance, or workflow projection cannot remain explicit without app-local heuristics, the lane stays experimental and read-only."
const experimentalPromotionRule =
  "Stable promotion requires `badlogicgames/pi-mono` and the checked-in Amp public-thread corpus to decode into the same normalized OpenAgentTraceRecord family, project into the same implementationStrategy surface, and expand beyond the current three-thread Amp source catalog while keeping projection coverage explicit."
const experimentalStopRule =
  "If branch lineage, redaction provenance, workflow projection, or broader Amp source diversity than the current three-thread public corpus cannot remain explicit without app-local heuristics, the lane stays experimental and read-only."
const implementationStrategyTarget =
  "Keep the declaration generic as source of truth, derive the exact product before runtime views, and avoid widening or helper indirection."

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

const normalizedPiMonoRecord = Effect.gen(function*() {
  const fixtures = yield* decodedFixtures
  const row = yield* Experimental.OpenAgentTrace.PiMono.decodeDatasetRow(piMonoTaskFirstRowFixture)

  return yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
    ...datasetAuthority,
    manifestEntry: fixtures.manifestEntry,
    reviewSidecar: fixtures.reviewSidecar,
    row
  })
})

const normalizedAmpRecord = loadPluginAdapterCapture().pipe(
  Effect.flatMap((capture) =>
    Experimental.OpenAgentTrace.normalizeCapture(Experimental.OpenAgentTrace.Amp.pluginAdapter, capture)
  ),
  Effect.map(({ record }) => record)
)

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
      const ampCatalog = yield* loadCatalog()
      const piMonoRecord = yield* normalizedPiMonoRecord
      const ampRecord = yield* normalizedAmpRecord
      const ampDataset = yield* (
        Experimental.OpenAgentTrace.ImplementationStrategy.loadDataset()
      )
      const piMonoCase = Experimental.OpenAgentTrace.ImplementationStrategy.projectCase({
        record: piMonoRecord,
        split: "train",
        expectedOutput: Experimental.OpenAgentTrace.ImplementationStrategy.Output.of(implementationStrategyTarget)
      })
      const ampCase = ampDataset.cases.find(
        (promptCase) => promptCase.task.sessionId === ampRecord.source.sessionId
      )
      const records = yield* Effect.all(
        [
          coverageRecord({ entryId: "task-first", rowFixture: piMonoTaskFirstRowFixture }),
          coverageRecord({ entryId: "chat-continuation", rowFixture: piMonoChatContinuationRowFixture })
        ],
        { concurrency: 1 }
      )
      const roundTrippedPiMonoRecord = yield* Schema.decode(Experimental.OpenAgentTrace.Record)(
        yield* Schema.encode(Experimental.OpenAgentTrace.Record)(piMonoRecord)
      )
      const roundTrippedAmpRecord = yield* Schema.decode(Experimental.OpenAgentTrace.Record)(
        yield* Schema.encode(Experimental.OpenAgentTrace.Record)(ampRecord)
      )

      expect(ampCase).toBeDefined()

      if (!ampCase) {
        return
      }

      const decodedPiMonoCase = yield* Schema.decodeUnknown(Experimental.OpenAgentTrace.CodingPromptCase)(piMonoCase)
      const decodedAmpCase = yield* Schema.decodeUnknown(Experimental.OpenAgentTrace.CodingPromptCase)(ampCase)
      const decodedPiMonoInput = yield* Schema.decodeUnknown(
        Experimental.OpenAgentTrace.ImplementationStrategy.InputSchema
      )(decodedPiMonoCase.input)
      const decodedAmpInput = yield* Schema.decodeUnknown(
        Experimental.OpenAgentTrace.ImplementationStrategy.InputSchema
      )(decodedAmpCase.input)
      const decodedPiMonoOutput = yield* Schema.decodeUnknown(
        Experimental.OpenAgentTrace.ImplementationStrategy.OutputSchema
      )(decodedPiMonoCase.expectedOutput ?? {})
      const decodedAmpOutput = yield* Schema.decodeUnknown(
        Experimental.OpenAgentTrace.ImplementationStrategy.OutputSchema
      )(decodedAmpCase.expectedOutput ?? {})
      const piMonoCaseShape = { ...decodedPiMonoCase, expectedOutput: decodedPiMonoCase.expectedOutput }
      const ampCaseShape = { ...decodedAmpCase, expectedOutput: decodedAmpCase.expectedOutput }
      const piMonoOutcomeShape = {
        ...decodedPiMonoCase.outcome,
        checksPassed: decodedPiMonoCase.outcome.checksPassed,
        finalAssistantMessage: decodedPiMonoCase.outcome.finalAssistantMessage,
        blockingReason: decodedPiMonoCase.outcome.blockingReason
      }
      const ampOutcomeShape = {
        ...decodedAmpCase.outcome,
        checksPassed: decodedAmpCase.outcome.checksPassed,
        finalAssistantMessage: decodedAmpCase.outcome.finalAssistantMessage,
        blockingReason: decodedAmpCase.outcome.blockingReason
      }
      const projectedAmpCase = Experimental.OpenAgentTrace.ImplementationStrategy.projectCase({
        record: ampRecord,
        split: ampCase.split,
        expectedOutput: Experimental.OpenAgentTrace.ImplementationStrategy.Output.of(decodedAmpOutput.strategy)
      })

      expect(Experimental._experimental).toBe(true)
      expect(summary.surface).toBe("open-agent-trace")
      expect(summary.status).toBe("experimental")
      expect(summary.fixtureBacked).toBe(true)
      expect(summary.datasetId).toBe("badlogicgames/pi-mono")
      expect(summary.stableReady).toBe(false)
      expect(summary.promotionRule).toBe(coveragePromotionRule)
      expect(summary.stopRule).toBe(coverageStopRule)
      expect(summary.records).toEqual(records)
      expect(ampCatalog).toHaveLength(3)
      expect(ampCatalog.every((entry) => entry.lanes.length === 2)).toBe(true)
      expect(roundTrippedPiMonoRecord).toStrictEqual(piMonoRecord)
      expect(roundTrippedAmpRecord).toStrictEqual(ampRecord)
      expect(decodedPiMonoCase.surfaceId).toBe(Experimental.OpenAgentTrace.ImplementationStrategy.surfaceId)
      expect(decodedAmpCase.surfaceId).toBe(Experimental.OpenAgentTrace.ImplementationStrategy.surfaceId)
      expect(ampDataset.surfaceId).toBe(Experimental.OpenAgentTrace.ImplementationStrategy.surfaceId)
      expect(ampDataset.cases.every((promptCase) => promptCase.surfaceId === decodedPiMonoCase.surfaceId)).toBe(true)
      expect(ampDataset.cases.length).toBeGreaterThan(ampCatalog.length)
      expect(Record.keys(piMonoCaseShape)).toEqual(Record.keys(ampCaseShape))
      expect(Record.keys(decodedPiMonoCase.task)).toEqual(Record.keys(decodedAmpCase.task))
      expect(Record.keys(decodedPiMonoCase.evidence)).toEqual(Record.keys(decodedAmpCase.evidence))
      expect(Record.keys(piMonoOutcomeShape)).toEqual(Record.keys(ampOutcomeShape))
      expect(Record.keys(decodedPiMonoInput)).toEqual(["task", "constraints", "files", "rejectedMoves"])
      expect(Record.keys(decodedAmpInput)).toEqual(["task", "constraints", "files", "rejectedMoves"])
      expect(Record.keys(decodedPiMonoOutput)).toEqual(["strategy"])
      expect(Record.keys(decodedAmpOutput)).toEqual(["strategy"])
      expect(ampCase.task).toStrictEqual(projectedAmpCase.task)
      expect(ampCase.evidence).toStrictEqual(projectedAmpCase.evidence)
      expect(ampCase.outcome).toStrictEqual(projectedAmpCase.outcome)
      expect(Experimental.OpenAgentTrace.ImplementationStrategy.inputFromPromptCase(ampCase)).toStrictEqual(
        projectedAmpCase.input
      )
      expect(readme).toContain("effect-dsp/experimental")
      expect(readme).toContain("checked-in Amp public-thread corpus")
      expect(readme).toContain("implementationStrategy")
      expect(readme).toContain("examples/24-amp-implementation-strategy-study.ts")
      expect(readme).toContain(experimentalPromotionRule)
      expect(readme).toContain(experimentalStopRule)
    }).pipe(Effect.provide(BunContext.layer)))
})
