/**
 * Contract for shared coding-agent projections over normalized traces.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { piMonoTaskFirstRowFixture, piShareHfManifestFixture } from "../../fixtures/open-agent-trace/pi-mono/index.js"

const normalizedRecordFixture = Effect.gen(function*() {
  const manifestEntry = yield* Experimental.OpenAgentTrace.PiMono.decodeManifestEntry(piShareHfManifestFixture)
  const row = yield* Experimental.OpenAgentTrace.PiMono.decodeDatasetRow(piMonoTaskFirstRowFixture)

  return yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
    datasetId: "badlogicgames/pi-mono",
    datasetRevision: "main",
    split: "train",
    sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
    licenseTag: "other",
    row,
    manifestEntry
  })
})

const decodeContentBlock = Schema.decodeSync(Experimental.OpenAgentTrace.ContentBlock)
const decodeDatasetSplits = Schema.decodeSync(
  Schema.Array(Experimental.OpenAgentTrace.CodingPromptDatasetSplitSchema)
)

const codingRecord = (options: { readonly testExitCode: number; readonly finalAssistantMessage: string }) =>
  Effect.map(
    normalizedRecordFixture,
    (baseRecord) =>
      new Experimental.OpenAgentTrace.Record({
        ...baseRecord,
        selection: new Experimental.OpenAgentTrace.Selection({
          selectedLeafEntryId: "00000007",
          selectionPolicy: "latest-leaf",
          activePathEntryIds: Arr.make(
            "00000001",
            "00000002",
            "00000003",
            "00000004",
            "00000005",
            "00000006",
            "00000007"
          ),
          compactedPathEntryIds: Arr.empty(),
          abandonedBranchRootIds: Arr.empty()
        }),
        branches: Arr.empty(),
        events: Arr.make(
          new Experimental.OpenAgentTrace.Message({
            eventId: "00000001",
            timestamp: "2026-04-12T12:00:00.000Z",
            eventKind: "message",
            actor: { actorKind: "user", role: "user" },
            contentBlocks: Arr.make(decodeContentBlock({
              type: "text",
              blockId: "00000001:text",
              text:
                "Implement the shared coding projection layer in src/OpenAgentTrace/coding/task.ts and src/OpenAgentTrace/coding/evidence.ts.\nKeep Effect-native patterns only."
            }))
          }),
          new Experimental.OpenAgentTrace.MetadataEvent({
            eventId: "00000002",
            parentEventId: "00000001",
            timestamp: "2026-04-12T12:00:01.000Z",
            eventKind: "custom-message",
            actor: { actorKind: "custom", role: "workspace-note", customType: "workspace-note" },
            contentBlocks: Arr.make(decodeContentBlock({
              type: "text",
              blockId: "00000002:text",
              text: "Do not add fallback adapters."
            }))
          }),
          new Experimental.OpenAgentTrace.Message({
            eventId: "00000003",
            parentEventId: "00000002",
            timestamp: "2026-04-12T12:00:02.000Z",
            eventKind: "message",
            actor: { actorKind: "assistant", role: "assistant", provider: "anthropic", model: "claude-sonnet-4-5" },
            contentBlocks: Arr.make(
              decodeContentBlock({
                type: "text",
                blockId: "00000003:text",
                text: "I’ll inspect the coding projection files first."
              }),
              decodeContentBlock({
                type: "toolCall",
                blockId: "00000003:tool",
                toolCallId: "tool-1",
                toolName: "Read",
                arguments: { file: "src/OpenAgentTrace/coding/task.ts" }
              })
            )
          }),
          new Experimental.OpenAgentTrace.RuntimeEvent({
            eventId: "00000004",
            parentEventId: "00000003",
            timestamp: "2026-04-12T12:00:03.000Z",
            eventKind: "bash-execution",
            actor: { actorKind: "runtime", role: "shell" },
            command:
              "rg -n \"projectCodingTask\" src/OpenAgentTrace/coding/task.ts src/OpenAgentTrace/coding/evidence.ts",
            outputText: "12:export const projectCodingTask = ...",
            exitCode: 0
          }),
          new Experimental.OpenAgentTrace.RuntimeEvent({
            eventId: "00000005",
            parentEventId: "00000004",
            timestamp: "2026-04-12T12:00:04.000Z",
            eventKind: "bash-execution",
            actor: { actorKind: "runtime", role: "shell" },
            command: "bun run test packages/effect-dsp/test/OpenAgentTrace/coding.contract.test.ts",
            outputText: options.testExitCode === 0 ? "1 passed" : "1 failed",
            exitCode: options.testExitCode
          }),
          new Experimental.OpenAgentTrace.RuntimeEvent({
            eventId: "00000006",
            parentEventId: "00000005",
            timestamp: "2026-04-12T12:00:05.000Z",
            eventKind: "bash-execution",
            actor: { actorKind: "runtime", role: "shell" },
            command: "bun run lint",
            outputText: "lint clean",
            exitCode: 0
          }),
          new Experimental.OpenAgentTrace.Message({
            eventId: "00000007",
            parentEventId: "00000006",
            timestamp: "2026-04-12T12:00:06.000Z",
            eventKind: "message",
            actor: { actorKind: "assistant", role: "assistant", provider: "anthropic", model: "claude-sonnet-4-5" },
            contentBlocks: Arr.make(decodeContentBlock({
              type: "text",
              blockId: "00000007:text",
              text: options.finalAssistantMessage
            }))
          })
        )
      })
  )

const implementationStrategySurface: Experimental.OpenAgentTrace.CodingPromptSurface = {
  surfaceId: "implementation-strategy",
  buildInput: ({ task, evidence, outcome }) => ({
    prompt: task.prompt,
    constraints: task.constraints.join("\n"),
    files: evidence.fileTouches.join("\n"),
    outcome: outcome.outcome
  })
}

describe("OpenAgentTrace/coding", () => {
  it.effect("derives shared task, evidence, outcome, and prompt cases from normalized traces without source-specific branching", () =>
    Effect.gen(function*() {
      const record = yield* codingRecord({
        testExitCode: 1,
        finalAssistantMessage: "Implemented the shared coding layer, but the targeted test still fails."
      })
      const task = Experimental.OpenAgentTrace.projectCodingTask(record)
      const evidence = Experimental.OpenAgentTrace.projectCodingEvidence(record)
      const outcome = Experimental.OpenAgentTrace.projectCodingOutcome(record, evidence)
      const promptCase = Experimental.OpenAgentTrace.projectCodingPromptCase({
        record,
        split: "train",
        surface: implementationStrategySurface,
        expectedOutput: { strategy: "Keep the coding layer source-agnostic." }
      })
      const roundTrip = yield* Schema.decode(Experimental.OpenAgentTrace.CodingPromptCase)(
        yield* Schema.encode(Experimental.OpenAgentTrace.CodingPromptCase)(promptCase)
      )

      expect(task.workKind).toBe("implementation")
      expect(task.files).toEqual([
        "src/OpenAgentTrace/coding/task.ts",
        "src/OpenAgentTrace/coding/evidence.ts"
      ])
      expect(task.constraints).toContain("Keep Effect-native patterns only.")
      expect(task.constraints).toContain("Do not add fallback adapters.")
      expect(evidence.commandCount).toBe(3)
      expect(evidence.toolNames).toEqual(["Read"])
      expect(evidence.checkRuns).toHaveLength(2)
      expect(evidence.failureSignals.some((signal) => signal.includes("bun run test"))).toBe(true)
      expect(outcome.outcome).toBe("mixed")
      expect(outcome.completed).toBe(true)
      expect(outcome.checksPassed).toBe(false)
      expect(outcome.finalAssistantMessage).toContain("shared coding layer")
      expect(promptCase.input.prompt).toContain("Implement the shared coding projection layer")
      expect(roundTrip).toStrictEqual(promptCase)
    }))

  it.effect("enforces strict split selection and requires labeled cases before compiling optimizer examples", () =>
    Effect.gen(function*() {
      const trainRecord = yield* codingRecord({
        testExitCode: 0,
        finalAssistantMessage: "Implemented the shared coding layer and the targeted test now passes."
      })
      const holdoutRecord = yield* codingRecord({
        testExitCode: 0,
        finalAssistantMessage: "Finished the refactor cleanly with passing checks."
      })
      const trainCase = Experimental.OpenAgentTrace.projectCodingPromptCase({
        record: trainRecord,
        split: "train",
        surface: implementationStrategySurface,
        expectedOutput: { strategy: "Keep the coding layer source-agnostic." }
      })
      const holdoutCase = Experimental.OpenAgentTrace.projectCodingPromptCase({
        record: holdoutRecord,
        split: "holdout",
        surface: implementationStrategySurface,
        expectedOutput: { strategy: "Compile only labeled cases." }
      })
      const unlabeledCase = Experimental.OpenAgentTrace.projectCodingPromptCase({
        record: holdoutRecord,
        split: "holdout",
        surface: implementationStrategySurface
      })
      const dataset = Experimental.OpenAgentTrace.CodingPromptDataset.of({
        datasetId: "coding-foundations",
        surfaceId: "implementation-strategy",
        cases: Arr.make(trainCase, holdoutCase)
      })
      const trainSplits = decodeDatasetSplits(["train"])
      const holdoutSplits = decodeDatasetSplits(["holdout"])
      const validationSplits = decodeDatasetSplits(["validation"])
      const trainExamples = yield* Experimental.OpenAgentTrace.codingPromptDatasetToExamples(dataset, trainSplits)
      const holdoutCases = yield* Experimental.OpenAgentTrace.selectCodingPromptDatasetCases(
        dataset,
        holdoutSplits
      )
      const validationResult = yield* Effect.either(
        Experimental.OpenAgentTrace.selectCodingPromptDatasetCases(
          dataset,
          validationSplits
        )
      )
      const emptySelectionResult = yield* Effect.either(
        Experimental.OpenAgentTrace.selectCodingPromptDatasetCases(dataset, Arr.empty())
      )
      const unlabeledResult = yield* Effect.either(Experimental.OpenAgentTrace.codingPromptCaseToExample(unlabeledCase))

      expect(dataset.splitSummary).toEqual({ train: 1, validation: 0, holdout: 1 })
      expect(holdoutCases).toHaveLength(1)
      expect(trainExamples[0]?.output).toEqual({ strategy: "Keep the coding layer source-agnostic." })
      expect(Either.isLeft(validationResult)).toBe(true)
      expect(Either.isLeft(emptySelectionResult)).toBe(true)
      expect(Either.isLeft(unlabeledResult)).toBe(true)
      if (Either.isLeft(validationResult)) {
        expect(validationResult.left._tag).toBe("CodingDatasetSelectionError")
      }
      if (Either.isLeft(emptySelectionResult)) {
        expect(emptySelectionResult.left._tag).toBe("CodingDatasetSelectionError")
      }
      if (Either.isLeft(unlabeledResult)) {
        expect(unlabeledResult.left._tag).toBe("CodingExampleCompilationError")
      }
    }))
})
