/**
 * Contract for Amp Plugin API raw capture decoding.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { loadPluginCapture, threadId } from "../../fixtures/open-agent-trace/amp/index.js"

describe("OpenAgentTrace/ampPlugin", () => {
  it.effect("decodes checked-in public Amp Plugin API captures into package-owned raw nouns", () =>
    Effect.gen(function*() {
      const capture = yield* loadPluginCapture()

      expect(capture.threadId).toBe(threadId)
      expect(capture.sessionStart.payload.thread?.id).toBe(threadId)
      expect(capture.turns[0]?.agentStart.payload.message).toContain("formatCount(2)")
      expect(capture.turns[0]?.events.map((event) => event.type)).toEqual([
        "tool.call",
        "tool.call",
        "tool.result",
        "tool.result",
        "tool.call",
        "tool.result",
        "tool.call",
        "tool.result"
      ])
      expect(
        capture.turns[0]?.events.map((event) => event.payload.tool).filter((tool, index, all) =>
          all.indexOf(tool) === index
        )
      ).toEqual([
        "Read",
        "edit_file",
        "Bash"
      ])
      expect(capture.turns[0]?.agentEnd.payload.messages.at(-1)?.role).toBe("assistant")
    }))
})
