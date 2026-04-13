/**
 * Contract for the package-owned implementation-strategy surface.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Record, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { piMonoTaskFirstRowFixture, piShareHfManifestFixture } from "../../fixtures/open-agent-trace/pi-mono/index.js"

const ImplementationStrategy = Experimental.OpenAgentTrace.ImplementationStrategy

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

describe("OpenAgentTrace/implementationStrategy", () => {
  it.effect("projects canonical input fields and labeled strategy outputs", () =>
    Effect.gen(function*() {
      const record = yield* normalizedRecordFixture
      const projection = {
        record,
        task: new Experimental.OpenAgentTrace.CodingTaskProjection({
          taskId: "task-1",
          sessionId: record.session.sessionId,
          workKind: "refactor",
          summary: "Keep the declaration product exact.",
          prompt: "Refactor the authority seam without widening.",
          constraints: Arr.make("Do not widen.", "Stay Effect-native."),
          files: Arr.make("derive.ts", "program.ts")
        }),
        evidence: new Experimental.OpenAgentTrace.CodingEvidenceProjection({
          fileTouches: Arr.make("program.ts", "transport.ts"),
          checkRuns: Arr.empty(),
          failureSignals: Arr.make("Avoid helper aliases.", "Do not add witness types."),
          toolNames: Arr.empty(),
          commandCount: 0
        }),
        outcome: new Experimental.OpenAgentTrace.CodingOutcomeProjection({
          outcome: "failure",
          completed: true,
          checksPassed: false,
          finalAssistantMessage: "The refactor widened the seam.",
          blockingReason: "Avoid helper aliases."
        })
      }
      const input = ImplementationStrategy.promptSurface.buildInput(projection)
      const promptCase = ImplementationStrategy.projectCase({
        record,
        split: "train",
        expectedOutput: ImplementationStrategy.Output.of("Keep the declaration generic as source of truth.")
      })
      const decodedInput = yield* Schema.decodeUnknown(ImplementationStrategy.InputSchema)(input)
      const decodedOutput = yield* Schema.decodeUnknown(ImplementationStrategy.OutputSchema)(
        promptCase.expectedOutput ?? {}
      )

      expect(ImplementationStrategy.surfaceId).toBe("implementation-strategy")
      expect(decodedInput).toEqual({
        task: "Refactor the authority seam without widening.",
        constraints: "- Do not widen.\n- Stay Effect-native.",
        files: "- derive.ts\n- program.ts\n- transport.ts",
        rejectedMoves: "- Avoid helper aliases.\n- Do not add witness types."
      })
      expect(Record.keys(decodedInput)).toEqual(["task", "constraints", "files", "rejectedMoves"])
      expect(promptCase.surfaceId).toBe(ImplementationStrategy.surfaceId)
      expect(Record.keys(decodedOutput)).toEqual(["strategy"])
    }))
})
