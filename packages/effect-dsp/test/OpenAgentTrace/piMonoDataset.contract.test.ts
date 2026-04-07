/**
 * Contract for the public `badlogicgames/pi-mono` dataset row envelope.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  piMonoChatContinuationRowFixture,
  piMonoTaskFirstRowFixture
} from "../fixtures/open-agent-trace/pi-mono/fixtures.js"

describe("OpenAgentTrace/piMonoDataset", () => {
  it.effect("decodes harness, session_id, traces, and file_name without app-local schema glue", () =>
    Effect.gen(function*() {
      const taskFirst = yield* Experimental.OpenAgentTrace.decodePiMonoDatasetRow(piMonoTaskFirstRowFixture)
      const chatContinuation = yield* Experimental.OpenAgentTrace.decodePiMonoDatasetRow(
        piMonoChatContinuationRowFixture
      )
      const datasetLines = yield* Effect.all(
        [taskFirst, chatContinuation].map((row) =>
          Schema.encode(Schema.parseJson(Experimental.OpenAgentTrace.PiMonoDatasetRow))(row)
        ),
        { concurrency: 1 }
      )
      const datasetDocument = datasetLines.join("\n")
      const rows = yield* Experimental.OpenAgentTrace.decodePiMonoDatasetDocument(datasetDocument)

      expect(taskFirst.harness).toBe("pi")
      expect(taskFirst.session_id).toBe(piMonoTaskFirstRowFixture.session_id)
      expect(taskFirst.file_name).toBe(piMonoTaskFirstRowFixture.file_name)
      expect(taskFirst.traces.length).toBeGreaterThan(1)
      expect(chatContinuation.harness).toBe("pi")
      expect(chatContinuation.session_id).toBe(piMonoChatContinuationRowFixture.session_id)
      expect(chatContinuation.file_name).toBe(piMonoChatContinuationRowFixture.file_name)
      expect(chatContinuation.traces.length).toBeGreaterThan(1)
      expect(rows).toEqual([taskFirst, chatContinuation])
    }))
})
