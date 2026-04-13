/**
 * Contract for Amp stream-json raw capture decoding.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { loadStreamJsonCapture, threadId } from "../../fixtures/open-agent-trace/amp/index.js"

describe("OpenAgentTrace/ampStreamJson", () => {
  it.effect("decodes checked-in stream-json captures into package-owned raw nouns", () =>
    Effect.gen(function*() {
      const capture = yield* loadStreamJsonCapture()
      const assistantLine = capture.lines[2]

      expect(capture.lines[0]?.type).toBe("system")
      expect(capture.lines[0]?.session_id).toBe(threadId)
      expect(assistantLine?.type).toBe("assistant")
      if (assistantLine?.type !== "assistant") {
        return
      }
      expect(assistantLine.message.content[1]).toEqual({
        type: "tool_use",
        id: "toolu_vrtx_01SsJNBFDb2gdGSfewbuqW5M",
        name: "Read",
        input: { path: "/private/tmp/amp-open-agent-trace-fixture/counter.ts" }
      })
      expect(capture.lines.at(-1)).toMatchObject({
        type: "result",
        subtype: "success",
        session_id: threadId
      })
    }))
})
